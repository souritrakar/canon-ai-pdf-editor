import { NextRequest, NextResponse } from "next/server";
import { writeFile, readFile, mkdir, rm } from "fs/promises";
import { exec } from "child_process";
import { promisify } from "util";
import path from "path";
import { randomUUID } from "crypto";

const execAsync = promisify(exec);

const PDF2HTMLEX_PATH = path.join(process.cwd(), "bin", "pdf2htmlEX");

export async function POST(request: NextRequest): Promise<NextResponse> {
  const tempDir = path.join("/tmp", `canon-${randomUUID()}`);

  try {
    const formData = await request.formData();
    const file = formData.get("pdf") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "No PDF file provided" },
        { status: 400 }
      );
    }

    if (file.type !== "application/pdf") {
      return NextResponse.json(
        { error: "File must be a PDF" },
        { status: 400 }
      );
    }

    // Create temp directory
    await mkdir(tempDir, { recursive: true });

    // Write uploaded PDF to temp file
    const pdfPath = path.join(tempDir, "input.pdf");
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(pdfPath, buffer);

    // Run pdf2htmlEX with all embedding enabled for self-contained HTML
    // Using zoom 1.0 for pixel-perfect accuracy (72 DPI matches PDF standard)
    const outputFileName = "output.html";
    const command = [
      PDF2HTMLEX_PATH,
      "--zoom", "1.0",
      "--embed-css", "1",
      "--embed-font", "1",
      "--embed-image", "1",
      "--embed-javascript", "1",
      "--embed-outline", "1",
      "--printing", "0",
      "--dest-dir", tempDir,
      pdfPath,
      outputFileName,
    ].join(" ");

    await execAsync(command, { timeout: 60000 });

    // Read the generated HTML
    const htmlPath = path.join(tempDir, outputFileName);
    const htmlContent = await readFile(htmlPath, "utf-8");

    // Clean up temp directory
    await rm(tempDir, { recursive: true, force: true });

    return NextResponse.json({ html: htmlContent });
  } catch (error) {
    // Clean up on error
    try {
      await rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }

    console.error("PDF conversion error:", error);

    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to convert PDF: ${message}` },
      { status: 500 }
    );
  }
}
