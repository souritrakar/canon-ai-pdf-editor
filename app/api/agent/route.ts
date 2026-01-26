import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";
import Groq from "groq-sdk";
import { AGENT_TOOLS, type AgentOperation } from "@/lib/agent/tools";
import { buildSystemPrompt, buildUserMessage, type AgentContext } from "@/lib/agent/context";
import type { MessageParam, ContentBlockParam, ToolResultBlockParam } from "@anthropic-ai/sdk/resources/messages";

const anthropicClient = new Anthropic();
const geminiClient = new GoogleGenerativeAI("AIzaSyAgXPBHrKk4zMY-K7QrDc8NH_ZtjanK-Tc");
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
 * Extract text content from an HTML element, handling nested tags properly
 */
function extractTextFromElement(html: string, startPos: number): { text: string; endPos: number } | null {
  // Find the tag name
  const tagNameMatch = html.substring(startPos + 1).match(/^(\w+)/);
  if (!tagNameMatch) return null;
  const tagName = tagNameMatch[1];

  // Find end of opening tag
  const openTagEnd = html.indexOf('>', startPos);
  if (openTagEnd === -1) return null;

  // Check for self-closing tag
  if (html[openTagEnd - 1] === '/') {
    return { text: '', endPos: openTagEnd + 1 };
  }

  // Find matching closing tag, accounting for nested same-name tags
  let depth = 1;
  let pos = openTagEnd + 1;
  const openPattern = new RegExp(`<${tagName}[\\s>]`, 'gi');
  const closePattern = `</${tagName}>`;

  while (depth > 0 && pos < html.length) {
    const nextClose = html.indexOf(closePattern, pos);
    if (nextClose === -1) break;

    // Check for any opens between current pos and next close
    openPattern.lastIndex = pos;
    let nextOpen = openPattern.exec(html);
    while (nextOpen && nextOpen.index < nextClose) {
      depth++;
      nextOpen = openPattern.exec(html);
    }

    depth--;
    pos = nextClose + closePattern.length;

    if (depth === 0) {
      const content = html.substring(openTagEnd + 1, nextClose);
      // Strip all HTML tags to get plain text
      let text = content.replace(/<[^>]*>/g, '').trim();

      // Normalize whitespace (multiple spaces → single space)
      text = text.replace(/\s+/g, ' ');

      // Fix for pdf2htmlEX: sometimes text is duplicated due to nested structure
      // This happens because parent elements contain their children's text too

      // Method 1: Check for direct string repetition with space/separator
      // e.g., "FR 201 FR 201" or "Grade 10  Grade 10"
      const halfLen = Math.floor(text.length / 2);
      if (text.length >= 4) {
        // Try to find if text is "X X" pattern (same text repeated)
        for (let i = halfLen - 1; i <= halfLen + 1 && i > 0 && i < text.length; i++) {
          const firstPart = text.substring(0, i).trim();
          const secondPart = text.substring(i).trim();
          if (firstPart === secondPart && firstPart.length > 0) {
            text = firstPart;
            break;
          }
        }
      }

      // Method 2: Word-based deduplication as fallback
      // e.g., "Hello World Hello World" → "Hello World"
      const words = text.split(/\s+/).filter(w => w.length > 0);
      if (words.length >= 2 && words.length % 2 === 0) {
        const half = words.length / 2;
        const firstHalf = words.slice(0, half).join(' ');
        const secondHalf = words.slice(half).join(' ');
        if (firstHalf === secondHalf) {
          text = firstHalf;
        }
      }

      return { text, endPos: pos };
    }
  }

  return null;
}

/**
 * Use Gemini 2.5 Flash to intelligently scan document and find matching elements
 *
 * Strategy: Extract ALL text-bearing elements from the PDF HTML, then use Gemini
 * to intelligently understand the query and find relevant elements.
 * This allows for semantic queries like "redact all information pertaining to party B"
 */
async function scanDocument(query: string, documentHtml: string): Promise<ScanResult[]> {
  console.log(`\n🔍 [SCAN] Starting document scan for query: "${query}"`);
  console.log(`📄 [SCAN] Document HTML length: ${documentHtml.length} chars`);

  const elements: Array<{id: string, text: string, page: number}> = [];

  // Extract ALL elements with data-canon-id attribute
  const idPattern = /data-canon-id="([^"]+)"/g;
  let match;

  while ((match = idPattern.exec(documentHtml)) !== null) {
    const id = match[1];

    // Find the opening tag start (go back to find <)
    let tagStart = match.index;
    while (tagStart > 0 && documentHtml[tagStart] !== '<') {
      tagStart--;
    }

    // Find the element's text content
    const result = extractTextFromElement(documentHtml, tagStart);
    if (result && result.text.length > 0) {
      // Extract page number from ID (format: pf1-el-42)
      const pageMatch = id.match(/^pf(\d+)/);
      const page = pageMatch ? parseInt(pageMatch[1], 10) : 1;
      elements.push({ id, text: result.text, page });
    }
  }

  console.log(`📋 [SCAN] Extracted ${elements.length} elements with text content`);
  if (elements.length > 0) {
    console.log(`📋 [SCAN] Sample elements (first 5):`);
    elements.slice(0, 5).forEach(e => console.log(`   - [${e.id}] "${e.text.substring(0, 50)}${e.text.length > 50 ? '...' : ''}"`));
  }

  if (elements.length === 0) {
    console.log(`⚠️ [SCAN] No elements found - returning empty`);
    return [];
  }

  // Create the FULL element list - NO TRUNCATION
  const elementList = elements.map(e => `[${e.id}] (page ${e.page}): "${e.text}"`).join('\n');

  const scanPrompt = `You are a document scanner for a PDF editor. Your task is to find ALL elements that match the user's query.

USER QUERY: "${query}"

DOCUMENT ELEMENTS (format: [element_id] (page N): "text content"):
${elementList}

INSTRUCTIONS:
1. Analyze the user's query to understand what they want to find
2. Go through EVERY element in the list above
3. Select ALL elements that match the query criteria
4. Be THOROUGH and COMPREHENSIVE - do not miss any matches

MATCHING GUIDELINES:
- Pay close attention to the EXACT wording of the query
- "containing [word]" or "with the word [X]" = LITERAL match - the exact word/phrase must appear
  Example: "containing French" matches "French language" but NOT "Francophone" or "FR 101"
- "about [topic]" or "related to [topic]" = SEMANTIC match - broader interpretation allowed
  Example: "about Party B" matches mentions of Party B, their name, role, address, etc.
- Pattern queries like "email addresses" or "phone numbers" = match the PATTERN format
- When in doubt about literal vs semantic, prefer PRECISION over recall

CRITICAL RULES:
- Return ONLY element IDs that exist EXACTLY as shown in the list above (e.g., "pf1-el-42")
- Do NOT invent, modify, or guess IDs
- Do NOT over-match - quality over quantity
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
  console.log(`🤖 [SCAN] Using ${useGroq ? 'Groq (llama-3.3-70b)' : 'Gemini 2.5 Flash'} for scanning`);
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
      const model = geminiClient.getGenerativeModel({ model: "gemini-2.5-flash" });
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

    // Validate that returned IDs actually exist in our element list
    const validIds = new Set(elements.map(e => e.id));
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

    // Use validResults directly - no aggressive leaf filtering
    // The LLM returns what it finds; we trust it and only filter invalid/duplicate IDs
    return validResults;
  } catch (error) {
    console.error(`❌ [SCAN] Error:`, error);
    // If Groq failed, try Gemini as fallback
    if (useGroq) {
      console.log(`🔄 [SCAN] Retrying with Gemini fallback...`);
      try {
        const model = geminiClient.getGenerativeModel({ model: "gemini-2.5-flash" });
        const result = await model.generateContent(scanPrompt);
        const responseText = result.response.text();
        const jsonMatch = responseText.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          const rawResults: ScanResult[] = JSON.parse(jsonMatch[0]);
          const validIds = new Set(elements.map(e => e.id));
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
  documentHtml?: string
): Promise<string> {
  if (toolName === "scan_document") {
    const query = toolInput.query as string;
    if (!documentHtml) {
      return JSON.stringify({ error: "No document HTML provided for scanning", matches: [] });
    }
    const results = await scanDocument(query, documentHtml);

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
                  context.documentHtml
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
