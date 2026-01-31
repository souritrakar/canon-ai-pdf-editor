import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";
import Groq from "groq-sdk";
import { AGENT_TOOLS, type AgentOperation } from "@/lib/agent/tools";
import { buildSystemPrompt, buildUserMessage, type AgentContext, type GDSMElementForScanner } from "@/lib/agent/context";
import type { MessageParam, ContentBlockParam, ToolResultBlockParam } from "@anthropic-ai/sdk/resources/messages";

const anthropicClient = new Anthropic();
const geminiClient = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const groqClient = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

// Use Opus 4.5 for main reasoning, Groq for fast scanning (with Gemini fallback for large docs)
const MAIN_MODEL = "claude-opus-4-5-20251101";
const GROQ_SCAN_MODEL = "llama-3.3-70b-versatile";
// Groq context limit is ~128K tokens, roughly ~4 chars per token = ~500K chars safe limit
const GROQ_CHAR_LIMIT = 400000;

interface AgentRequest {
  instruction: string;
  context: AgentContext;
  stream?: boolean;
}

interface ScanResult {
  elementId: string;
  textContent: string;
  page?: number;
}

/**
 * Use LLM to intelligently scan GDSM and find matching elements
 *
 * Strategy: Use pre-built GDSM elements (with positions/coordinates) instead of parsing HTML.
 * This is more efficient and includes spatial data for better context.
 */
async function scanDocument(query: string, gdsmElements: GDSMElementForScanner[]): Promise<ScanResult[]> {
  console.log(`\n🔍 [SCAN] Starting GDSM scan for query: "${query}"`);
  console.log(`📋 [SCAN] GDSM elements: ${gdsmElements.length}`);

  if (gdsmElements.length === 0) {
    console.log(`⚠️ [SCAN] No elements in GDSM - returning empty`);
    return [];
  }

  // Log sample elements
  console.log(`📋 [SCAN] Sample elements (first 5):`);
  gdsmElements.slice(0, 5).forEach(e =>
    console.log(`   - [${e.id}] p${e.page} (${e.x.toFixed(0)},${e.y.toFixed(0)}) "${e.text.substring(0, 50)}${e.text.length > 50 ? '...' : ''}"`)
  );

  // Create element list with coordinates for spatial context
  const elementList = gdsmElements.map(e => {
    const pos = `(${e.x.toFixed(0)},${e.y.toFixed(0)}) ${e.width.toFixed(0)}x${e.height.toFixed(0)}`;
    const type = e.semanticType ? ` [${e.semanticType}]` : '';
    return `[${e.id}] page ${e.page} | pos: ${pos}${type}: "${e.text}"`;
  }).join('\n');

  // Log what we're sending to LLM
  const lines = elementList.split('\n');
  console.log(`📤 [SCAN] Sending ${lines.length} elements to LLM (${elementList.length} chars)`);
  console.log(`📤 [SCAN] First element: ${lines[0]}`);
  console.log(`📤 [SCAN] Last element: ${lines[lines.length - 1]}`);

  // For debugging: check local regex matches to compare with LLM
  const wordMatch = query.match(/containing (?:the word )?['"']?(\w+)['"']?/i);
  if (wordMatch) {
    const word = wordMatch[1];
    const regexMatches = gdsmElements.filter(e =>
      new RegExp(`\\b${word}\\b`, 'i').test(e.text)
    );
    console.log(`🔬 [SCAN] Regex found ${regexMatches.length} matches for "${word}":`);
    regexMatches.forEach(e => console.log(`   - [${e.id}] "${e.text.substring(0, 60)}"`));
  }

  const scanPrompt = `You are a document scanner for a PDF editor. Your task is to find ALL elements that match the user's query.

## DATA SOURCE: Global Document Structure Model (GDSM)

You are given the GDSM - a structured representation of all document elements with:
- **Element ID**: Unique identifier (e.g., "pf1-el-42")
- **Page number**: Which page the element is on
- **Position**: (x, y) coordinates and width x height in pixels (page-relative)
- **Semantic type**: Auto-detected type like [email], [phone], [date], etc.
- **Text content**: The actual text in the element

This spatial data allows you to understand document layout (headers at top, footers at bottom, columns, etc.).

USER QUERY: "${query}"

DOCUMENT ELEMENTS (format: [element_id] (page N): "text content"):
${elementList}

INSTRUCTIONS:
1. Analyze the user's query to understand EXACTLY what they want to find
2. Go through EVERY element in the list above
3. Select ALL elements that match the query criteria
4. Be THOROUGH but PRECISE - match what the user asked for, not more

## MATCHING RULES (CRITICAL - READ CAREFULLY)

### EXACT WORD MATCHING (Default for "containing", "with the word", etc.)
When the user asks for elements containing a specific word, match the EXACT WORD as a standalone token:
- A word is standalone if it's surrounded by spaces, punctuation, or line boundaries
- Do NOT match the word as a SUBSTRING of a longer word

EXAMPLES of EXACT WORD matching:
| Query: "containing French" | Text | Match? | Reason |
|---------------------------|------|--------|--------|
| | "French language" | ✅ YES | "French" is a standalone word |
| | "in French" | ✅ YES | "French" is a standalone word |
| | "French" | ✅ YES | "French" is the entire text |
| | "Francophone" | ❌ NO | "French" is a substring, not standalone |
| | "Frenchman" | ❌ NO | "French" is a prefix, not standalone |
| | "FR 101" | ❌ NO | "FR" is not "French" |

| Query: "containing phone" | Text | Match? | Reason |
|---------------------------|------|--------|--------|
| | "phone number" | ✅ YES | "phone" is standalone |
| | "smartphone" | ❌ NO | "phone" is a suffix, not standalone |
| | "telephone" | ❌ NO | "phone" is a suffix, not standalone |

### SEMANTIC MATCHING (For "about", "related to", "regarding")
When the user asks for content ABOUT or RELATED TO a topic, use broader interpretation:
- Match direct mentions AND contextually related content
- Example: "about Party B" matches "John Smith (Party B)", "the Buyer's address", etc.

### PATTERN MATCHING (For formats like emails, phones, dates)
Match the FORMAT/PATTERN, not a literal word:
- "email addresses" → match patterns like "user@domain.com"
- "phone numbers" → match patterns like "(555) 123-4567" or "555-123-4567"
- "dates" → match patterns like "January 5, 2024" or "01/05/2024"

## VALIDATION RULES
- Return ONLY element IDs that exist EXACTLY as shown in the list above
- Do NOT invent, modify, or guess IDs
- Do NOT over-match - precision is more important than recall
- If unsure whether something matches, do NOT include it
- If no matches exist, return an empty array

RESPONSE FORMAT:
Return a JSON array with ALL matching elements. Each object must have:
- elementId: the exact ID from the list (e.g., "pf1-el-42")
- textContent: the text content of that element
- page: the page number

Example response:
[
  {"elementId": "pf1-el-42", "textContent": "example text", "page": 1},
  {"elementId": "pf2-el-15", "textContent": "another match", "page": 2}
]

If no matches: []

Return ONLY the JSON array, no other text or explanation.`;

  // Decide which model to use based on document size
  // Groq is faster but has ~128K token limit (~400K chars)
  // Gemini has 1M token context for larger documents
  const useGroq = elementList.length < GROQ_CHAR_LIMIT && process.env.GROQ_API_KEY;
  console.log(`🤖 [SCAN] Using ${useGroq ? 'Groq (llama-3.3-70b)' : 'Gemini 2.0 Flash'} for scanning`);
  console.log(`📏 [SCAN] Element list size: ${elementList.length} chars (limit: ${GROQ_CHAR_LIMIT})`);

  try {
    let responseText: string;

    if (useGroq) {
      console.log(`⏳ [SCAN] Calling Groq API...`);
      const startTime = Date.now();
      const completion = await groqClient.chat.completions.create({
        model: GROQ_SCAN_MODEL,
        messages: [{ role: "user", content: scanPrompt }],
        temperature: 0.1,
        max_tokens: 8000,
      });
      responseText = completion.choices[0]?.message?.content || "[]";
      console.log(`✅ [SCAN] Groq responded in ${Date.now() - startTime}ms`);
    } else {
      console.log(`⏳ [SCAN] Calling Gemini API...`);
      const startTime = Date.now();
      const model = geminiClient.getGenerativeModel({ model: "gemini-3-flash-preview" });
      const result = await model.generateContent(scanPrompt);
      responseText = result.response.text();
      console.log(`✅ [SCAN] Gemini responded in ${Date.now() - startTime}ms`);
    }

    // Parse the JSON response
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.log(`⚠️ [SCAN] No JSON array found in response`);
      return [];
    }

    const rawResults: ScanResult[] = JSON.parse(jsonMatch[0]);
    console.log(`📊 [SCAN] Raw results from LLM: ${rawResults.length} matches`);

    // Validate that returned IDs actually exist in our GDSM
    const validIds = new Set(gdsmElements.map(e => e.id));
    const seenIds = new Set<string>();
    const validResults = rawResults.filter(r => {
      if (!validIds.has(r.elementId)) {
        console.log(`   ⚠️ Invalid ID filtered out: ${r.elementId}`);
        return false;
      }
      if (seenIds.has(r.elementId)) return false;
      seenIds.add(r.elementId);
      return true;
    });

    console.log(`✅ [SCAN] Final valid results: ${validResults.length} matches`);
    validResults.forEach(r => console.log(`   - [${r.elementId}] "${r.textContent.substring(0, 40)}${r.textContent.length > 40 ? '...' : ''}"`));

    return validResults;
  } catch (error) {
    console.error(`❌ [SCAN] Error:`, error);
    // If Groq failed, try Gemini as fallback
    if (useGroq) {
      console.log(`🔄 [SCAN] Retrying with Gemini fallback...`);
      try {
        const model = geminiClient.getGenerativeModel({ model: "gemini-2.0-flash" });
        const result = await model.generateContent(scanPrompt);
        const responseText = result.response.text();
        const jsonMatch = responseText.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          const rawResults: ScanResult[] = JSON.parse(jsonMatch[0]);
          const validIds = new Set(gdsmElements.map(e => e.id));
          const fallbackResults = rawResults.filter(r => validIds.has(r.elementId));
          console.log(`✅ [SCAN] Gemini fallback succeeded: ${fallbackResults.length} matches`);
          return fallbackResults;
        }
      } catch (fallbackError) {
        console.error(`❌ [SCAN] Gemini fallback also failed:`, fallbackError);
      }
    }
    return [];
  }
}

/**
 * Execute a tool call and return the result
 */
async function executeToolCall(
  toolName: string,
  toolInput: Record<string, unknown>,
  gdsmElements?: GDSMElementForScanner[]
): Promise<string> {
  if (toolName === "scan_document") {
    const query = toolInput.query as string;
    if (!gdsmElements || gdsmElements.length === 0) {
      return JSON.stringify({ error: "No GDSM elements provided for scanning", matches: [] });
    }
    const results = await scanDocument(query, gdsmElements);

    return JSON.stringify({
      matches: results,
      count: results.length,
      message: results.length > 0
        ? `Found ${results.length} element(s) matching "${query}"`
        : `No elements found matching "${query}"`
    });
  }

  // For other tools (replace_text, redact_element, etc.), we don't execute server-side
  // Just acknowledge that the operation was recorded
  return JSON.stringify({
    status: "queued",
    message: `Operation ${toolName} queued for client-side execution`
  });
}

export async function POST(request: Request): Promise<Response> {
  try {
    const { instruction, context, stream: useStream = true }: AgentRequest = await request.json();

    if (!instruction?.trim()) {
      return Response.json(
        { success: false, error: "No instruction provided", operations: [], explanation: "" },
        { status: 400 }
      );
    }

    // Build prompts
    const systemPrompt = buildSystemPrompt(context);
    const userMessage = buildUserMessage(instruction, context);

    // Stream response to client using SSE with agentic loop
    if (useStream) {
      const encoder = new TextEncoder();

      const readableStream = new ReadableStream({
        async start(controller) {
          try {
            // Helper to send SSE event
            const send = (event: string, data: unknown) => {
              controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
            };

            // Build messages from conversation history for multi-turn context
            const messages: MessageParam[] = [];

            // Add previous conversation turns (excluding the current instruction which is already in history)
            if (context.conversationHistory && context.conversationHistory.length > 1) {
              const previousMessages = context.conversationHistory.slice(0, -1);
              for (const msg of previousMessages) {
                messages.push({ role: msg.role, content: msg.content });
              }
            }

            // Add current instruction with full context
            messages.push({ role: "user", content: userMessage });

            // All operations collected across turns
            const allOperations: AgentOperation[] = [];
            let fullExplanation = "";

            // Agentic loop - continue until model says "end_turn"
            let turn = 0;
            const maxTurns = 10; // Safety limit

            while (turn < maxTurns) {
              turn++;

              const stream = anthropicClient.messages.stream({
                model: MAIN_MODEL,
                max_tokens: 4096,
                system: systemPrompt,
                tools: AGENT_TOOLS,
                messages,
              });

              const toolCalls: Map<number, { id: string; name: string; inputJson: string }> = new Map();
              let currentToolIndex = -1;
              let turnText = "";

              stream.on("text", (text) => {
                turnText += text;
                send("text", { text });
              });

              // Use streamEvent to capture tool use events
              stream.on("streamEvent", (event) => {
                if (event.type === "content_block_start" && event.content_block.type === "tool_use") {
                  currentToolIndex = event.index;
                  const toolBlock = event.content_block;
                  toolCalls.set(currentToolIndex, {
                    id: toolBlock.id,
                    name: toolBlock.name,
                    inputJson: "",
                  });
                  // Don't send tool_start for scan_document - it runs server-side silently
                  if (toolBlock.name !== "scan_document") {
                    send("tool_start", { tool: toolBlock.name, id: toolBlock.id });
                  }
                }

                if (event.type === "content_block_stop") {
                  const tool = toolCalls.get(event.index);
                  if (tool) {
                    try {
                      const input = tool.inputJson ? JSON.parse(tool.inputJson) : {};
                      if (tool.name !== "scan_document") {
                        send("tool_complete", { tool: tool.name, id: tool.id, input });
                      }
                    } catch {
                      if (tool.name !== "scan_document") {
                        send("tool_complete", { tool: tool.name, id: tool.id, input: {} });
                      }
                    }
                  }
                }
              });

              stream.on("inputJson", (partialJson) => {
                const tool = toolCalls.get(currentToolIndex);
                if (tool) {
                  // Accumulate the raw JSON string chunks
                  tool.inputJson += partialJson;
                }
              });

              // Wait for this turn to complete
              const response = await stream.finalMessage();

              fullExplanation += turnText;

              // Collect operations from this turn
              const turnToolCalls: Array<{ id: string; name: string; input: Record<string, unknown> }> = [];

              for (const block of response.content) {
                if (block.type === "tool_use") {
                  turnToolCalls.push({
                    id: block.id,
                    name: block.name,
                    input: block.input as Record<string, unknown>,
                  });

                  // Only add non-scan operations to the final operations list
                  if (block.name !== "scan_document") {
                    allOperations.push({
                      id: block.id,
                      tool: block.name,
                      input: block.input as Record<string, unknown>,
                    });
                  }
                }
              }

              // If no tool calls or stop_reason is end_turn, we're done
              if (response.stop_reason === "end_turn" || turnToolCalls.length === 0) {
                break;
              }

              // Otherwise, we need to execute tools and continue the loop
              // Build assistant message with all content blocks
              const assistantContent: ContentBlockParam[] = response.content.map(block => {
                if (block.type === "text") {
                  return { type: "text" as const, text: block.text };
                } else if (block.type === "tool_use") {
                  return {
                    type: "tool_use" as const,
                    id: block.id,
                    name: block.name,
                    input: block.input as Record<string, unknown>
                  };
                }
                return { type: "text" as const, text: "" };
              });

              messages.push({ role: "assistant", content: assistantContent });

              // Execute each tool and collect results
              const toolResults: ToolResultBlockParam[] = [];

              for (const toolCall of turnToolCalls) {
                const result = await executeToolCall(
                  toolCall.name,
                  toolCall.input,
                  context.gdsmElements
                );

                send("tool_result", { tool: toolCall.name, id: toolCall.id, result: JSON.parse(result) });

                toolResults.push({
                  type: "tool_result",
                  tool_use_id: toolCall.id,
                  content: result,
                });
              }

              // Add tool results to messages
              messages.push({ role: "user", content: toolResults });
            }


            // Send final complete event
            send("complete", {
              success: true,
              operations: allOperations,
              explanation: fullExplanation.trim(),
              turns: turn,
            });

            controller.close();
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : "Unknown error";
            controller.enqueue(encoder.encode(`event: error\ndata: ${JSON.stringify({ error: errorMsg })}\n\n`));
            controller.close();
          }
        },
      });

      return new Response(readableStream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
        },
      });
    }

    // Non-streaming fallback (simplified - no agentic loop)
    // Build messages with conversation history
    const fallbackMessages: MessageParam[] = [];
    if (context.conversationHistory && context.conversationHistory.length > 1) {
      const previousMessages = context.conversationHistory.slice(0, -1);
      for (const msg of previousMessages) {
        fallbackMessages.push({ role: msg.role, content: msg.content });
      }
    }
    fallbackMessages.push({ role: "user", content: userMessage });

    const response = await anthropicClient.messages.create({
      model: MAIN_MODEL,
      max_tokens: 2048,
      system: systemPrompt,
      tools: AGENT_TOOLS,
      messages: fallbackMessages,
    });

    const operations: AgentOperation[] = [];
    let explanation = "";

    for (const block of response.content) {
      if (block.type === "tool_use") {
        operations.push({
          id: block.id,
          tool: block.name,
          input: block.input as Record<string, unknown>,
        });
      } else if (block.type === "text") {
        explanation += block.text;
      }
    }

    return Response.json({
      success: true,
      operations,
      explanation: explanation.trim(),
      stopReason: response.stop_reason ?? "end_turn",
    });

  } catch (error) {
    console.error("❌ Agent API error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return Response.json(
      { success: false, error: errorMessage, operations: [], explanation: "" },
      { status: 500 }
    );
  }
}
