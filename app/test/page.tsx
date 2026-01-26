"use client";

import { useState, useRef, useCallback, useEffect } from "react";

interface TextItem {
  str: string;
  width: number;
  height: number;
  transform: number[];
  fontName: string;
}

interface PageData {
  pageNumber: number;
  width: number;
  height: number;
  textItems: TextItem[];
}

export default function TestPage() {
  const [pages, setPages] = useState<PageData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPage, setSelectedPage] = useState(1);
  const [scale, setScale] = useState(1.5);
  const [pdfjsReady, setPdfjsReady] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pdfjs = useRef<typeof import("pdfjs-dist") | null>(null);
  const pdfDoc = useRef<unknown>(null);

  // Initialize pdf.js on mount
  useEffect(() => {
    const initPdfjs = async () => {
      try {
        const pdfjsLib = await import("pdfjs-dist");
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
        pdfjs.current = pdfjsLib;
        setPdfjsReady(true);
        console.log(`✅ PDF.js ${pdfjsLib.version} initialized`);
      } catch (err) {
        console.error("Failed to initialize PDF.js:", err);
        setError("Failed to initialize PDF.js library");
      }
    };
    initPdfjs();
  }, []);

  // Handle file upload
  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !pdfjs.current) return;

    setLoading(true);
    setError(null);
    setPages([]);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjs.current.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
      pdfDoc.current = pdf;
      console.log(`✅ PDF loaded: ${pdf.numPages} pages`);

      const pagesData: PageData[] = [];

      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const viewport = page.getViewport({ scale: 1 });
        const textContent = await page.getTextContent();

        const textItems: TextItem[] = textContent.items
          .filter((item): item is { str: string; width: number; height: number; transform: number[]; fontName: string; dir: string; hasEOL: boolean } =>
            "str" in item && typeof item.str === "string" && item.str.trim().length > 0
          )
          .map((item) => ({
            str: item.str,
            width: item.width,
            height: item.height,
            transform: item.transform,
            fontName: item.fontName,
          }));

        console.log(`Page ${pageNum}: ${textItems.length} text items`);

        pagesData.push({
          pageNumber: pageNum,
          width: viewport.width,
          height: viewport.height,
          textItems,
        });
      }

      setPages(pagesData);
      setSelectedPage(1);
    } catch (err) {
      console.error("Error loading PDF:", err);
      setError(err instanceof Error ? err.message : "Failed to load PDF");
    } finally {
      setLoading(false);
    }
  }, []);

  // Render page to canvas
  useEffect(() => {
    if (!pdfDoc.current || !canvasRef.current) return;

    const renderPage = async () => {
      try {
        // @ts-expect-error - dynamic type
        const page = await pdfDoc.current.getPage(selectedPage);
        const viewport = page.getViewport({ scale });
        const canvas = canvasRef.current!;
        const context = canvas.getContext("2d")!;

        canvas.width = viewport.width;
        canvas.height = viewport.height;

        await page.render({ canvasContext: context, viewport }).promise;
      } catch (err) {
        console.error("Error rendering page:", err);
      }
    };

    renderPage();
  }, [selectedPage, scale, pages]);

  const currentPage = pages.find((p) => p.pageNumber === selectedPage);

  return (
    <div className="min-h-screen bg-stone-100 p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-stone-900 mb-2">PDF.js Test Lab</h1>
        <p className="text-stone-600 mb-8">
          Testing PDF parsing with pdf.js as an alternative to pdf2htmlEX
        </p>

        {/* Upload */}
        <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-6 mb-8">
          <h2 className="text-lg font-semibold text-stone-900 mb-4">Upload PDF</h2>
          {!pdfjsReady ? (
            <div className="text-stone-600">Initializing PDF.js...</div>
          ) : (
            <input
              type="file"
              accept=".pdf"
              onChange={handleFileUpload}
              className="block w-full text-sm text-stone-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-orange-50 file:text-orange-600 hover:file:bg-orange-100"
            />
          )}
          {loading && <div className="mt-4 text-stone-600">Parsing PDF...</div>}
          {error && <div className="mt-4 text-red-600">{error}</div>}
        </div>

        {pages.length > 0 && (
          <div className="grid grid-cols-3 gap-6">
            {/* Canvas */}
            <div className="col-span-2 bg-white rounded-xl shadow-sm border border-stone-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Page {selectedPage} of {pages.length}</h2>
                <div className="flex items-center gap-4">
                  <label className="text-sm text-stone-600">
                    Scale: {scale.toFixed(1)}x
                    <input
                      type="range"
                      min="0.5"
                      max="3"
                      step="0.1"
                      value={scale}
                      onChange={(e) => setScale(parseFloat(e.target.value))}
                      className="ml-2 w-20"
                    />
                  </label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setSelectedPage((p) => Math.max(1, p - 1))}
                      disabled={selectedPage === 1}
                      className="px-3 py-1 rounded bg-stone-100 hover:bg-stone-200 disabled:opacity-50"
                    >
                      Prev
                    </button>
                    <button
                      onClick={() => setSelectedPage((p) => Math.min(pages.length, p + 1))}
                      disabled={selectedPage === pages.length}
                      className="px-3 py-1 rounded bg-stone-100 hover:bg-stone-200 disabled:opacity-50"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>
              <div className="border border-stone-300 shadow-lg inline-block relative">
                <canvas ref={canvasRef} />
                {/* Bounding boxes for each text element */}
                <div
                  className="absolute pointer-events-none"
                  style={{
                    top: 0,
                    left: 0,
                    width: canvasRef.current?.width || 0,
                    height: canvasRef.current?.height || 0,
                  }}
                >
                  {currentPage?.textItems.map((item, idx) => {
                    // PDF coordinates: origin bottom-left, y increases upward
                    // Canvas coordinates: origin top-left, y increases downward
                    // transform[4] = x position, transform[5] = y baseline position
                    const pdfX = item.transform[4];
                    const pdfY = item.transform[5];
                    const pdfWidth = item.width;
                    const pdfHeight = item.height || 12; // fallback height

                    // Convert to canvas coordinates (scaled)
                    const canvasX = pdfX * scale;
                    const canvasY = (currentPage.height - pdfY) * scale;
                    const canvasWidth = Math.max(pdfWidth * scale, 2);
                    const canvasHeight = Math.max(pdfHeight * scale, 10);

                    // Position: canvasY is the baseline, so box top = baseline - height
                    const boxTop = canvasY - canvasHeight;
                    const boxLeft = canvasX;

                    return (
                      <div
                        key={idx}
                        className="absolute border border-orange-500/50 bg-orange-500/10 hover:bg-orange-500/30 hover:border-orange-500 pointer-events-auto cursor-pointer transition-colors"
                        style={{
                          left: boxLeft,
                          top: boxTop,
                          width: canvasWidth,
                          height: canvasHeight,
                        }}
                        onClick={() => console.log(`Clicked: "${item.str}" at (${pdfX.toFixed(1)}, ${pdfY.toFixed(1)}) size ${pdfWidth.toFixed(1)}x${pdfHeight.toFixed(1)}`)}
                        title={`"${item.str}"\nx: ${pdfX.toFixed(1)}, y: ${pdfY.toFixed(1)}\nw: ${pdfWidth.toFixed(1)}, h: ${pdfHeight.toFixed(1)}`}
                      />
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Text Items */}
            <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-6 h-[700px] overflow-y-auto">
              <h2 className="text-lg font-semibold text-stone-900 mb-4">
                Text Items ({currentPage?.textItems.length || 0})
              </h2>
              <div className="space-y-1">
                {currentPage?.textItems.map((item, i) => (
                  <div key={i} className="text-xs p-2 bg-stone-50 rounded hover:bg-stone-100">
                    <div className="font-mono text-stone-900 truncate">&quot;{item.str}&quot;</div>
                    <div className="text-stone-500">
                      x:{item.transform[4].toFixed(0)} y:{item.transform[5].toFixed(0)} w:{item.width.toFixed(0)} h:{item.height.toFixed(0)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Info */}
        <div className="mt-8 bg-white rounded-xl shadow-sm border border-stone-200 p-6">
          <h2 className="text-lg font-semibold text-stone-900 mb-4">PDF.js Text Item Data</h2>
          <div className="text-sm text-stone-600 space-y-2">
            <p><strong>Each text item provides:</strong></p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li><code>str</code> - the text content</li>
              <li><code>transform[4]</code> - x position (left edge)</li>
              <li><code>transform[5]</code> - y position (baseline, PDF coords - origin bottom-left)</li>
              <li><code>width</code> - text width</li>
              <li><code>height</code> - text height</li>
            </ul>
            <p className="mt-4"><strong>Bounding box:</strong> (x, y) → (x + width, y + height)</p>
            <p className="text-stone-500">Note: PDF origin is bottom-left. For canvas (top-left origin): canvasY = pageHeight - pdfY</p>
          </div>
        </div>
      </div>
    </div>
  );
}
