import { invoke } from "@tauri-apps/api/core";
import { pdfjsLib, getPdfDocumentParams } from "./pdfInit";

const memoryCache = new Map<string, string>();
const SESSION_CACHE_PREFIX = "syllex_thumb_";

interface QueueTask {
  key: string;
  vaultRoot: string;
  relativePath: string;
  fileType: string;
  resolve: (url: string | null) => void;
  reject: (err: any) => void;
}

const taskQueue: QueueTask[] = [];
let activeWorkers = 0;
const MAX_CONCURRENT_WORKERS = 3;

function processQueue() {
  if (activeWorkers >= MAX_CONCURRENT_WORKERS || taskQueue.length === 0) {
    return;
  }

  const task = taskQueue.shift();
  if (!task) return;

  activeWorkers++;

  generateThumbnail(task.vaultRoot, task.relativePath, task.fileType)
    .then((url) => {
      task.resolve(url);
    })
    .catch(() => {
      task.resolve(null);
    })
    .finally(() => {
      activeWorkers--;
      processQueue();
    });
}

async function generateThumbnail(
  vaultRoot: string,
  relativePath: string,
  fileType: string
): Promise<string | null> {
  const key = `${vaultRoot}:${relativePath}`;

  // Check in-memory cache
  if (memoryCache.has(key)) {
    return memoryCache.get(key) || null;
  }

  // Check sessionStorage
  try {
    const saved = sessionStorage.getItem(SESSION_CACHE_PREFIX + key);
    if (saved) {
      memoryCache.set(key, saved);
      return saved;
    }
  } catch {
    // Ignore storage quota errors
  }

  const normalizedExt = fileType.toLowerCase();
  if (normalizedExt !== "pdf" && normalizedExt !== "ppt" && normalizedExt !== "pptx") {
    return null;
  }

  let fileBytes: number[];
  try {
    const isPpt = normalizedExt === "ppt" || normalizedExt === "pptx";
    if (isPpt) {
      fileBytes = await invoke<number[]>("convert_ppt_to_pdf", {
        vaultRoot,
        relativePath,
      });
    } else {
      fileBytes = await invoke<number[]>("read_module_bytes", {
        vaultRoot,
        relativePath,
      });
    }
  } catch {
    return null;
  }

  let loadingTask: pdfjsLib.PDFDocumentLoadingTask | null = null;
  try {
    const uint8 = new Uint8Array(fileBytes);
    loadingTask = pdfjsLib.getDocument(getPdfDocumentParams(uint8));
    const doc = await loadingTask.promise;

    if (doc.numPages < 1) {
      void loadingTask.destroy();
      return null;
    }

    const page = await doc.getPage(1);
    const unscaledViewport = page.getViewport({ scale: 1 });

    // Target ~140px width for sharp crisp render on retina / high-DPI displays
    const targetWidth = 140;
    const scale = targetWidth / unscaledViewport.width;
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement("canvas");
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);

    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) {
      void loadingTask.destroy();
      return null;
    }

    // Fill white background in case page has transparency
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    await page.render({
      canvasContext: ctx,
      viewport,
      canvas,
      intent: "display",
    }).promise;

    const dataUrl = canvas.toDataURL("image/jpeg", 0.82);

    // Save to memory
    memoryCache.set(key, dataUrl);

    // Try save to sessionStorage
    try {
      sessionStorage.setItem(SESSION_CACHE_PREFIX + key, dataUrl);
    } catch {
      // Session storage might be full; in-memory cache remains active
    }

    void loadingTask.destroy();
    return dataUrl;
  } catch (err) {
    if (loadingTask) {
      try {
        void loadingTask.destroy();
      } catch {}
    }
    return null;
  }
}

/**
 * Retrieves or asynchronously generates a first-page snapshot cover for a PDF or PPT module.
 */
export function getModuleCoverThumbnail(
  vaultRoot: string,
  relativePath: string,
  fileType: string
): Promise<string | null> {
  const key = `${vaultRoot}:${relativePath}`;

  if (memoryCache.has(key)) {
    return Promise.resolve(memoryCache.get(key) || null);
  }

  return new Promise<string | null>((resolve, reject) => {
    taskQueue.push({
      key,
      vaultRoot,
      relativePath,
      fileType,
      resolve,
      reject,
    });
    processQueue();
  });
}
