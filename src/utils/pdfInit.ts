import * as pdfjsLib from "pdfjs-dist";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";

if (typeof window !== "undefined" && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;
}

export function getPdfDocumentParams(data: Uint8Array) {
  const origin =
    typeof window !== "undefined" && window.location?.origin && window.location.origin !== "null"
      ? window.location.origin
      : "";

  return {
    data,
    cMapUrl: origin ? `${origin}/cmaps/` : "./cmaps/",
    cMapPacked: true,
    standardFontDataUrl: origin ? `${origin}/standard_fonts/` : "./standard_fonts/",
    wasmUrl: origin ? `${origin}/wasm/` : "./wasm/",
    iccUrl: origin ? `${origin}/iccs/` : "./iccs/",
    isEvalSupported: false,
    // Keep glyph metrics deterministic across WebKitGTK and WebView2. PDF.js's
    // built-in path renderer does not race the browser's asynchronous font
    // registration and does not depend on fonts installed on the host OS.
    disableFontFace: true,
    useSystemFonts: false,
  };
}

export { pdfjsLib };
