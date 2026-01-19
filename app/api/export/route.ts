import { NextRequest, NextResponse } from "next/server";
import puppeteer, { type PDFOptions } from "puppeteer";

export async function POST(request: NextRequest): Promise<NextResponse> {
  let browser = null;

  try {
    const { html } = await request.json();

    if (!html || typeof html !== "string") {
      return NextResponse.json(
        { error: "No HTML content provided" },
        { status: 400 }
      );
    }

    // Launch puppeteer with appropriate settings
    browser = await puppeteer.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--font-render-hinting=none",
      ],
    });

    const page = await browser.newPage();

    // Set content and wait for all resources to load
    await page.setContent(html, {
      waitUntil: ["load", "domcontentloaded", "networkidle0"],
    });

    // Wait a bit more for fonts to fully load
    await page.evaluate(() => document.fonts?.ready);

    // Get page dimensions from pdf2htmlEX structure
    // pdf2htmlEX wraps each page in a div with class "pc" (page container)
    // and sets explicit width/height in the CSS
    const pageInfo = await page.evaluate(() => {
      const pages = document.querySelectorAll(".pc");

      if (pages.length > 0) {
        const pageData: Array<{ width: number; height: number }> = [];

        pages.forEach((pg) => {
          const style = window.getComputedStyle(pg);
          pageData.push({
            width: parseFloat(style.width),
            height: parseFloat(style.height),
          });
        });

        return {
          pages: pageData,
          // Use first page dimensions as the PDF page size
          width: pageData[0].width,
          height: pageData[0].height,
          pageCount: pages.length,
        };
      }

      // Fallback: try to get from #page-container or body
      const container = document.querySelector("#page-container");
      if (container) {
        const style = window.getComputedStyle(container);
        return {
          pages: [{ width: parseFloat(style.width), height: parseFloat(style.height) }],
          width: parseFloat(style.width),
          height: parseFloat(style.height),
          pageCount: 1,
        };
      }

      return {
        pages: [{ width: document.body.scrollWidth, height: document.body.scrollHeight }],
        width: document.body.scrollWidth,
        height: document.body.scrollHeight,
        pageCount: 1,
      };
    });

    // Clean up selection styles and ensure redactions are permanent before export
    await page.evaluate(() => {
      // Remove any selection outlines we added (only the coral selection color)
      document.querySelectorAll("*").forEach((el) => {
        const htmlEl = el as HTMLElement;
        // Skip redacted elements - don't touch their styles
        if (htmlEl.hasAttribute("data-canon-redacted")) {
          return;
        }
        if (htmlEl.style) {
          htmlEl.style.outline = "";
          htmlEl.style.outlineOffset = "";
          if (htmlEl.style.backgroundColor?.includes("rgba(235, 79, 52")) {
            htmlEl.style.backgroundColor = "";
          }
        }
      });

      // TRUE REDACTION: Ensure redacted elements render as black boxes
      // The viewer already applied inline styles for width/height during redaction
      // We just need to clean up and ensure the black background is preserved
      document.querySelectorAll("[data-canon-redacted]").forEach((el) => {
        const htmlEl = el as HTMLElement;

        // CRITICAL: Remove attributes that store original text
        el.removeAttribute("data-canon-original");
        el.removeAttribute("data-canon-redacted");

        // The dimensions are already set as inline styles by the viewer
        // Just ensure text is cleared and black background is solid
        htmlEl.textContent = '';
        htmlEl.style.backgroundColor = '#000000';
        htmlEl.style.color = 'transparent';
        htmlEl.style.overflow = 'hidden';
      });

      // Remove canon-id and canon-original attributes from ALL elements
      document.querySelectorAll("[data-canon-id]").forEach((el) => {
        el.removeAttribute("data-canon-id");
      });
      document.querySelectorAll("[data-canon-original]").forEach((el) => {
        el.removeAttribute("data-canon-original");
      });

      // Process comments for export - convert interactive markers to static annotations
      // Remove any open comment bubbles (input dialogs)
      document.querySelectorAll(".canon-comment-bubble").forEach((el) => {
        el.remove();
      });

      // Style comment markers for clean PDF export - Adobe Acrobat sticky note style
      document.querySelectorAll("[data-canon-comment]").forEach((marker) => {
        const htmlMarker = marker as HTMLElement;
        const commentText = htmlMarker.getAttribute("data-canon-comment-text");

        // Remove hover effects and transitions for static export
        htmlMarker.style.transition = "none";
        htmlMarker.style.transform = "none";

        // If comment has text, create a sticky note style annotation
        if (commentText) {
          const parent = htmlMarker.parentElement;
          if (parent) {
            const markerLeft = parseFloat(htmlMarker.style.left) || 0;
            const markerTop = parseFloat(htmlMarker.style.top) || 0;

            // Create sticky note annotation box
            const annotation = document.createElement("div");
            annotation.className = "canon-comment-annotation";
            annotation.style.position = "absolute";
            annotation.style.left = (markerLeft + 24) + "px";
            annotation.style.top = markerTop + "px";
            annotation.style.backgroundColor = "#FEF9C3";
            annotation.style.border = "1px solid #EAB308";
            annotation.style.borderRadius = "2px";
            annotation.style.width = "180px";
            annotation.style.boxShadow = "2px 2px 6px rgba(0,0,0,0.15)";
            annotation.style.zIndex = "1001";
            annotation.style.fontFamily = "system-ui, -apple-system, sans-serif";

            // Header
            const header = document.createElement("div");
            header.style.backgroundColor = "#EAB308";
            header.style.padding = "3px 6px";
            header.style.fontSize = "10px";
            header.style.fontWeight = "500";
            header.style.color = "#422006";
            header.textContent = "Comment";

            // Content
            const content = document.createElement("div");
            content.style.padding = "6px 8px";
            content.style.fontSize = "11px";
            content.style.lineHeight = "1.4";
            content.style.color = "#1C1917";
            content.style.wordWrap = "break-word";
            content.style.whiteSpace = "pre-wrap";
            content.textContent = commentText;

            annotation.appendChild(header);
            annotation.appendChild(content);
            parent.appendChild(annotation);
          }
        } else {
          // Remove markers without text
          htmlMarker.remove();
        }

        // Clean up data attributes for export
        htmlMarker.removeAttribute("data-canon-comment-text");
        htmlMarker.removeAttribute("data-canon-comment-id");
      });

      // Reset user-select
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    });

    // Set viewport to match content
    await page.setViewport({
      width: Math.ceil(pageInfo.width),
      height: Math.ceil(pageInfo.height * pageInfo.pageCount),
      deviceScaleFactor: 1,
    });

    // PDF options - match exact page dimensions
    // Using tagged: true to ensure text layer is preserved for accessibility and selectability
    const pdfOptions: PDFOptions = {
      width: `${pageInfo.width}px`,
      height: `${pageInfo.height}px`,
      printBackground: true,
      preferCSSPageSize: false,
      margin: {
        top: "0px",
        right: "0px",
        bottom: "0px",
        left: "0px",
      },
      scale: 1,
      tagged: true, // Preserves text layer for selectability in PDF readers
      outline: false,
    };

    // Generate PDF
    const pdfBuffer = await page.pdf(pdfOptions);

    await browser.close();
    browser = null;

    return NextResponse.json({
      pdf: Buffer.from(pdfBuffer).toString("base64"),
      filename: "document.pdf",
      pageInfo: {
        width: pageInfo.width,
        height: pageInfo.height,
        pageCount: pageInfo.pageCount,
      },
    });
  } catch (error) {
    if (browser) {
      await browser.close();
    }

    console.error("Export error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to export PDF",
      },
      { status: 500 }
    );
  }
}
