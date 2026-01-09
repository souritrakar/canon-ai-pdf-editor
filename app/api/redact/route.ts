import { NextRequest, NextResponse } from "next/server";
import { JSDOM } from "jsdom";

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Handle both FormData and JSON
    const contentType = request.headers.get("content-type") || "";
    let html: string | null = null;
    let elementId: string | null = null;

    if (contentType.includes("application/json")) {
      const json = await request.json();
      html = json.html;
      elementId = json.elementId;
    } else {
      const formData = await request.formData();
      html = formData.get("html") as string | null;
      elementId = formData.get("elementId") as string | null;
    }

    if (!html) {
      return NextResponse.json(
        { error: "No HTML provided" },
        { status: 400 }
      );
    }

    // Parse the HTML
    const dom = new JSDOM(html);
    const document = dom.window.document;

    let targetElement: Element | null = null;
    let targetText = "";

    if (elementId) {
      // Find the specific element by its data-canon-id
      targetElement = document.querySelector(`[data-canon-id="${elementId}"]`);

      // If not found by data-canon-id, try to find by generated ID pattern
      if (!targetElement) {
        // The ID format is like "div-5-1234567890" or "span-3-1234567890"
        const allElements = document.querySelectorAll("div, span");
        allElements.forEach((el) => {
          if (el.getAttribute("data-canon-id") === elementId) {
            targetElement = el;
          }
        });
      }
    }

    // If no specific element found, pick a random one
    if (!targetElement) {
      const allElements = document.querySelectorAll("div, span");
      const textElements: Element[] = [];

      allElements.forEach((el) => {
        // Skip already redacted elements
        if (el.hasAttribute("data-canon-redacted")) return;

        const hasDirectText = Array.from(el.childNodes).some(
          (node) => node.nodeType === 3 && node.textContent?.trim()
        );
        const isLeafWithText = el.children.length === 0 && el.textContent?.trim();

        if (hasDirectText || isLeafWithText) {
          textElements.push(el);
        }
      });

      if (textElements.length === 0) {
        return NextResponse.json(
          { error: "No text elements found in HTML" },
          { status: 400 }
        );
      }

      const randomIndex = Math.floor(Math.random() * textElements.length);
      targetElement = textElements[randomIndex];
    }

    if (!targetElement) {
      return NextResponse.json(
        { error: "Could not find element to redact" },
        { status: 400 }
      );
    }

    targetText = targetElement.textContent?.trim() || "";

    // Apply redaction
    const el = targetElement as HTMLElement;
    el.setAttribute("data-canon-redacted", "true");
    el.setAttribute(
      "style",
      `${el.getAttribute("style") || ""} background-color: #000000 !important; color: #000000 !important; -webkit-text-fill-color: #000000 !important; user-select: none !important;`
    );

    // Get the modified HTML
    const modifiedHtml = dom.serialize();

    return NextResponse.json({
      html: modifiedHtml,
      redactedText: targetText,
    });
  } catch (error) {
    console.error("Redaction error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to apply redaction",
      },
      { status: 500 }
    );
  }
}
