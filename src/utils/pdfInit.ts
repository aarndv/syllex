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
    // Let PDF.js load the document's generated/embedded font faces, but avoid
    // substituting arbitrary host fonts with different metrics. Page rendering
    // waits for the operator list and Font Loading API before publishing.
    disableFontFace: false,
    useSystemFonts: false,
  };
}

export { pdfjsLib };
