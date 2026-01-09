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

      // TRUE REDACTION: Replace redacted elements completely
      // This process must completely destroy any trace of the original text
      document.querySelectorAll("[data-canon-redacted]").forEach((el) => {
        const htmlEl = el as HTMLElement;

        // CRITICAL: Remove the data-canon-original attribute which stores the text!
        el.removeAttribute("data-canon-original");

        // Get dimensions before any modifications
        const width = htmlEl.offsetWidth || parseFloat(htmlEl.style.width) || 50;
        const height = htmlEl.offsetHeight || parseFloat(htmlEl.style.height) || 14;

        // Get computed position info
        const computedStyle = window.getComputedStyle(htmlEl);
        const position = computedStyle.position;
        const left = computedStyle.left;
        const top = computedStyle.top;
        const bottom = computedStyle.bottom;

        // COMPLETELY destroy the element content first
        while (htmlEl.firstChild) {
          htmlEl.removeChild(htmlEl.firstChild);
        }
        htmlEl.textContent = '';
        htmlEl.innerHTML = '';

        // Create a canvas element - canvas renders as raster, no text layer
        const canvas = document.createElement('canvas');
        canvas.width = Math.ceil(width);
        canvas.height = Math.ceil(height);
        canvas.style.width = width + 'px';
        canvas.style.height = height + 'px';
        canvas.style.display = 'inline-block';
        canvas.style.verticalAlign = 'top';

        // Copy positioning from original element
        if (position && position !== 'static') {
          canvas.style.position = position;
          if (left && left !== 'auto') canvas.style.left = left;
          if (top && top !== 'auto') canvas.style.top = top;
          if (bottom && bottom !== 'auto') canvas.style.bottom = bottom;
        }

        // Draw black rectangle on canvas
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#000000';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

        // Replace the element with the canvas
        if (htmlEl.parentNode) {
          htmlEl.parentNode.replaceChild(canvas, htmlEl);
        }
      });

      // Remove canon-id and canon-original attributes from ALL elements
      document.querySelectorAll("[data-canon-id]").forEach((el) => {
        el.removeAttribute("data-canon-id");
      });
      document.querySelectorAll("[data-canon-original]").forEach((el) => {
        el.removeAttribute("data-canon-original");
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
