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
 * Result from contextual search LLM - specific search criteria
 */
interface ContextualSearchResult {
  searchCriteria: string;
  resolvedEntities: Array<{
    reference: string;
    resolvedTo: string;
    context: string;
  }>;
  targetContent: string[];
  strategy: string;
}

/**
 * Extract plain text from GDSM elements for contextual understanding
 * Organizes text by page without element IDs - just the content
 */
function extractPlainText(gdsmElements: GDSMElementForScanner[]): string {
  if (!gdsmElements || gdsmElements.length === 0) return "";

  // Group elements by page
  const pageMap = new Map<number, GDSMElementForScanner[]>();
  gdsmElements.forEach(el => {
    const elements = pageMap.get(el.page) || [];
    elements.push(el);
    pageMap.set(el.page, elements);
  });

  // Sort pages and build text
  const sortedPages = Array.from(pageMap.keys()).sort((a, b) => a - b);

  let text = "";
  for (const pageNum of sortedPages) {
    const pageElements = pageMap.get(pageNum) || [];
    // Sort elements by y position (top to bottom) then x (left to right)
    pageElements.sort((a, b) => {
      if (Math.abs(a.y - b.y) < 5) return a.x - b.x; // Same line
      return a.y - b.y;
    });

    text += `\n--- Page ${pageNum} ---\n`;

    let lastY = -1;
    for (const el of pageElements) {
      // Add newline if significant y-distance (new line)
      if (lastY !== -1 && Math.abs(el.y - lastY) > 10) {
        text += "\n";
      } else if (lastY !== -1) {
        text += " ";
      }
      text += el.text;
      lastY = el.y;
    }
  }

  return text.trim();
}

/**
 * Detect if a query needs contextual resolution
 * These are queries with entity references, relational terms, or semantic complexity
 */
function needsContextualResolution(query: string): boolean {
  const contextualPatterns = [
    // Entity references
    /party\s+[a-z]/i,                    // "Party A", "Party B"
    /the\s+(buyer|seller|vendor|client|contractor|employee|employer)/i,
    /\b(their|his|her|its)\s+\w+/i,      // Possessive references
    /\bmy\s+\w+/i,                        // "my projects", "my experience"

    // Relational/semantic queries
    /related\s+to/i,
    /associated\s+with/i,
    /information\s+(about|regarding|concerning)/i,
    /belongs?\s+to/i,
    /owned\s+by/i,

    // Financial/legal terms that need context
    /financial\s+(information|data|details|records)/i,
    /confidential\s+\w+/i,
    /sensitive\s+\w+/i,
    /personal\s+\w+/i,

    // References that need document understanding
    /the\s+(company|organization|firm|corporation)/i,
    /\b(first|second|third)\s+(party|company|section)/i,
  ];

  return contextualPatterns.some(pattern => pattern.test(query));
}

/**
 * Contextual Search LLM - Understands document content and resolves entities
 *
 * This is the first pass in the two-pass architecture:
 * 1. Contextual Search LLM (this): Reads plain text, understands context, resolves entities
 * 2. Scanner LLM: Searches GDSM with element IDs to find specific matches
 */
async function resolveContextualQuery(
  query: string,
  plainText: string
): Promise<ContextualSearchResult | null> {
  console.log(`\n🧠 [CONTEXT] Starting contextual query resolution`);
  console.log(`📝 [CONTEXT] Original query: "${query}"`);
  console.log(`📄 [CONTEXT] Document text: ${plainText.length} chars`);

  // Truncate very long documents for the contextual LLM
  const MAX_CONTEXT_LENGTH = 50000; // ~12.5K tokens
  const truncatedText = plainText.length > MAX_CONTEXT_LENGTH
    ? plainText.substring(0, MAX_CONTEXT_LENGTH) + "\n\n[... document truncated ...]"
    : plainText;

  const contextualPrompt = `<contextual_search_llm>

<role>
You are the Contextual Search LLM in a two-pass document search system.
Your job is to READ and UNDERSTAND the document, then provide SPECIFIC search criteria for the Scanner LLM.
</role>

<task>
Given a user's query and document content:
1. READ the entire document to understand its structure, entities, and relationships
2. IDENTIFY who/what the query refers to (entity resolution)
3. OUTPUT specific, concrete search criteria that reference ACTUAL content from the document
</task>

<user_query>${query}</user_query>

<document_content>
${truncatedText}
</document_content>

<entity_resolution_rules>
When the query contains entity references, you MUST resolve them:

- "Party A" / "Party B" → Find actual names (e.g., "Acme Corporation", "John Smith")
- "the Buyer" / "the Seller" → Find who is playing that role in the document
- "my projects" → Identify project names mentioned
- "their financial information" → Identify whose finances AND what specific financial data appears
- "the company" → Identify which company is referenced in context
</entity_resolution_rules>

<output_format>
Return a JSON object with these fields:

{
  "searchCriteria": "A detailed, specific description for the Scanner LLM. Reference ACTUAL content from the document.",

  "resolvedEntities": [
    {
      "reference": "Party B",
      "resolvedTo": "Acme Corporation",
      "context": "Identified as the Buyer in the contract header"
    }
  ],

  "targetContent": [
    "Specific text or patterns to find",
    "For example: '$50,000', 'Acme Corporation', 'Payment Terms'"
  ],

  "strategy": "Brief explanation of search strategy"
}
</output_format>

<examples>

<example>
Query: "redact Party B's financial information"
Document contains: "AGREEMENT between TechStart Inc. (Party A, the Seller) and Acme Corporation (Party B, the Buyer). Purchase Price: $500,000. Payment Schedule: 50% upfront, 50% on delivery."

Output:
{
  "searchCriteria": "Find all financial information related to Acme Corporation (identified as Party B/the Buyer). This includes: dollar amounts like '$500,000', payment terms, percentages like '50%', and any text mentioning purchase price, payment schedule, or payment terms.",
  "resolvedEntities": [
    {"reference": "Party B", "resolvedTo": "Acme Corporation", "context": "Defined in agreement header as 'Party B, the Buyer'"}
  ],
  "targetContent": ["$500,000", "50%", "Acme Corporation", "Payment Schedule", "Purchase Price"],
  "strategy": "Search for resolved entity name and all monetary/payment content associated with their role as Buyer"
}
</example>

<example>
Query: "highlight my project names"
Document contains: "PROJECTS: DataViz Pro - Analytics dashboard... CloudSync - File synchronization... Resume Builder - AI-powered resume tool"

Output:
{
  "searchCriteria": "Find project names which appear as capitalized titles, typically formatted as 'Name - Description'. Specific projects to find: 'DataViz Pro', 'CloudSync', 'Resume Builder'",
  "resolvedEntities": [],
  "targetContent": ["DataViz Pro", "CloudSync", "Resume Builder"],
  "strategy": "Search for identified project names as they appear in the PROJECTS section"
}
</example>

</examples>

<critical_rules>
1. You MUST read the document and reference ACTUAL content, not generic patterns
2. Your output should be specific enough that the Scanner can find exact matches
3. If you cannot resolve an entity, explain what you found and suggest alternatives
4. Always provide targetContent with specific strings from the document
5. Return ONLY valid JSON - no explanations outside the JSON
</critical_rules>

</contextual_search_llm>`;

  try {
    console.log(`⏳ [CONTEXT] Calling Gemini Flash for contextual understanding...`);
    const startTime = Date.now();

    const model = geminiClient.getGenerativeModel({ model: "gemini-3-flash-preview" });
    const result = await model.generateContent(contextualPrompt);
    const responseText = result.response.text();

    console.log(`✅ [CONTEXT] Gemini responded in ${Date.now() - startTime}ms`);
    console.log(`📤 [CONTEXT] Response: ${responseText.substring(0, 500)}...`);

    // Parse the JSON response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.log(`⚠️ [CONTEXT] No JSON object found in response`);
      return null;
    }

    const parsed: ContextualSearchResult = JSON.parse(jsonMatch[0]);

    console.log(`🎯 [CONTEXT] Resolved entities: ${parsed.resolvedEntities.length}`);
    parsed.resolvedEntities.forEach(e =>
      console.log(`   - "${e.reference}" → "${e.resolvedTo}" (${e.context})`)
    );
    console.log(`🎯 [CONTEXT] Target content: ${parsed.targetContent.join(', ')}`);
    console.log(`🎯 [CONTEXT] Strategy: ${parsed.strategy}`);

    return parsed;
  } catch (error) {
    console.error(`❌ [CONTEXT] Error in contextual resolution:`, error);
    return null;
  }
}

/**
 * Use LLM to intelligently scan GDSM and find matching elements
 *
 * Strategy: Two-pass architecture for semantic queries:
 * 1. Contextual Search LLM (gemini-3-flash-preview): Reads document text, resolves entities
 * 2. Scanner LLM (groq/gemini): Searches GDSM with element IDs
 *
 * For simple queries, skip the contextual pass and go directly to scanner.
 */
async function scanDocument(query: string, gdsmElements: GDSMElementForScanner[]): Promise<ScanResult[]> {
  console.log(`\n🔍 [SCAN] Starting GDSM scan for query: "${query}"`);
  console.log(`📋 [SCAN] GDSM elements: ${gdsmElements.length}`);

  // Check if query needs contextual resolution (entity references, semantic complexity)
  let effectiveQuery = query;
  let contextualResult: ContextualSearchResult | null = null;

  if (needsContextualResolution(query)) {
    console.log(`🧠 [SCAN] Query needs contextual resolution, invoking Contextual Search LLM...`);

    // Extract plain text for contextual understanding
    const plainText = extractPlainText(gdsmElements);

    if (plainText.length > 100) {
      contextualResult = await resolveContextualQuery(query, plainText);

      if (contextualResult) {
        // Use the enhanced search criteria from contextual LLM
        effectiveQuery = contextualResult.searchCriteria;
        console.log(`🎯 [SCAN] Using enhanced query: "${effectiveQuery.substring(0, 200)}..."`);
      } else {
        console.log(`⚠️ [SCAN] Contextual resolution failed, using original query`);
      }
    }
  } else {
    console.log(`⚡ [SCAN] Query is simple, skipping contextual resolution`);
  }

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

  // Build contextual hints section if we have contextual resolution results
  let contextualHints = '';
  if (contextualResult) {
    const entityInfo = contextualResult.resolvedEntities.length > 0
      ? contextualResult.resolvedEntities.map(e =>
          `- "${e.reference}" = "${e.resolvedTo}" (${e.context})`
        ).join('\n')
      : '';

    const targetInfo = contextualResult.targetContent.length > 0
      ? `Target content to find:\n${contextualResult.targetContent.map(t => `- "${t}"`).join('\n')}`
      : '';

    contextualHints = `
<contextual_intelligence>
The Contextual Search LLM has analyzed the document and resolved the query.

${entityInfo ? `<resolved_entities>\n${entityInfo}\n</resolved_entities>` : ''}

${targetInfo ? `<target_content>\n${targetInfo}\n</target_content>` : ''}

<strategy>${contextualResult.strategy}</strategy>

PRIORITY: Use the target content and resolved entities above to find matches.
These are SPECIFIC items identified from the document that match the user's intent.
</contextual_intelligence>
`;
  }

  const scanPrompt = `<document_scanner>

<task>
Find ALL elements matching the query using SEMANTIC UNDERSTANDING and SPATIAL AWARENESS.
</task>

<data_source>
Global Document Structure Model (GDSM):
- Element ID (e.g., "pf1-el-42")
- Page number
- Position: (x,y) + width×height in pixels
- Semantic type: [email], [phone], [date], [url], etc.
- Text content

Position gives layout context: headers at y≈0, footers at y≈max, indented content, etc.
</data_source>

<user_query>${effectiveQuery}</user_query>
${contextualHints}

<elements>
${elementList}
</elements>

<matching_rules>

<semantic_patterns>
Query may be SEMANTIC, not literal. INTERPRET meaning:

<pattern type="section_headers">
  Triggers: "section titles", "section headings", "headers like EXPERIENCE"
  Find: ALL-CAPS text ("EXPERIENCE", "EDUCATION", "TECHNICAL PROJECTS")
  - Standalone (not mid-sentence)
  - Short (< 30 chars)
  - Common headers: EXPERIENCE, EDUCATION, SKILLS, PROJECTS, SUMMARY, OBJECTIVE
</pattern>

<pattern type="project_names">
  Triggers: "project names", "my projects", "project titles"
  Find: Proper nouns (capitalized), often followed by " - " or " | "
  - Starts with capital
  - Title format (2-4 words)
  - NOT full sentences
  - Near bullet points
</pattern>

<pattern type="contact_info">
  Triggers: "contact information", "contact details"
  Find: Email (@), phone (digit patterns), often at top/bottom
  - [email] or [phone] semantic types
  - y < 100 (header) or y > page_height-100 (footer)
</pattern>

<pattern type="dates">
  Triggers: "dates", "date ranges"
  Find: MM/DD/YYYY, Month YYYY, YYYY-YYYY formats
  - [date] semantic type
  - Month names, year patterns
</pattern>

</semantic_patterns>

<exact_word>
For "containing [word]":
Match STANDALONE word only (with spaces/punctuation boundaries)

"containing French":
✅ "French language" (standalone)
❌ "Francophone" (substring)
</exact_word>

<pattern_match>
For structural patterns (emails, phones, SSNs):
Match FORMAT, not literal text
Use semantic type hints
</pattern_match>

<spatial>
Use position:
- Headers: y < 100
- Footers: y > page_height-100
- Indented: x > 50
- Same line: same y ± 5px
</spatial>

</matching_rules>

<quality>
1. THOROUGH - scan every element
2. PRECISE - match exactly what's requested
3. SEMANTIC - understand intent
4. When unsure, INCLUDE (false positive > false negative)
</quality>

<output>
JSON array of matching elements:
[
  {"elementId": "pf1-el-42", "textContent": "example", "page": 1},
  {"elementId": "pf2-el-15", "textContent": "another", "page": 2}
]

If none: []

Return ONLY JSON - no explanations.
</output>

</document_scanner>`;

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
