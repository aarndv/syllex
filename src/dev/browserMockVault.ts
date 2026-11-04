import type { VaultNode, VaultScanResult } from "../types/vault";

const ROOT = "/Browser Demo Vault";
const encoder = new TextEncoder();

function makePdf(title: string, course: string): number[] {
  const text = `BT /F1 22 Tf 72 720 Td (${title}) Tj /F1 12 Tf 0 -32 Td (${course}) Tj ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${encoder.encode(text).length} >>\nstream\n${text}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(encoder.encode(pdf).length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = encoder.encode(pdf).length;
  pdf += `xref\n0 ${offsets.length}\n0000000000 65535 f \n`;
  pdf += offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("");
  pdf += `trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Array.from(encoder.encode(pdf));
}

const documents = new Map<string, number[]>();

function file(folder: string, name: string, course: string): VaultNode {
  const relativePath = folder ? `${folder}/${name}` : name;
  const bytes = makePdf(name.slice(0, -4), course);
  documents.set(relativePath, bytes);
  return {
    name,
    relative_path: relativePath,
    node_type: { File: "Pdf" },
    size_bytes: bytes.length,
    children: [],
  };
}

function folder(parent: string, name: string, children: VaultNode[]): VaultNode {
  return {
    name,
    relative_path: parent ? `${parent}/${name}` : name,
    node_type: "Folder",
    children,
  };
}

const scan: VaultScanResult = {
  root_path: ROOT,
  root_nodes: [
    file("", "Welcome to the Demo.pdf", "Browser-only sample vault"),
    folder("", "Biology 101", [
      file("Biology 101", "Course Outline.pdf", "Biology 101"),
      folder("Biology 101", "Lectures", [
        file("Biology 101/Lectures", "Cells and Tissues.pdf", "Biology 101"),
        file("Biology 101/Lectures", "Genetics Basics.pdf", "Biology 101"),
      ]),
    ]),
    folder("", "Mathematics 204", [
      file("Mathematics 204", "Syllabus.pdf", "Mathematics 204"),
      folder("Mathematics 204", "Problem Sets", [
        file("Mathematics 204/Problem Sets", "Limits Practice.pdf", "Mathematics 204"),
        file("Mathematics 204/Problem Sets", "Derivatives Practice.pdf", "Mathematics 204"),
      ]),
    ]),
    folder("", "History 310", [
      file("History 310", "Reading List.pdf", "History 310"),
      folder("History 310", "Primary Sources", [
        file("History 310/Primary Sources", "Archive Notes.pdf", "History 310"),
      ]),
    ]),
  ],
  warnings: [],
  hidden_items: [],
};

export function installBrowserMockVault() {
  const readingProgress = new Map<string, number>();
  Object.assign(window, {
    __TAURI_INTERNALS__: {
      async invoke(command: string, args: Record<string, unknown> = {}): Promise<unknown> {
        const path = String(args.relativePath ?? "");
        switch (command) {
          case "get_selected_vault":
          case "set_selected_vault":
            return args.path === null ? null : ROOT;
          case "scan_vault":
            return scan;
          case "list_subvaults":
            return [{ name: "Browser Demo Vault", path: ROOT, file_count: documents.size }];
          case "read_module_bytes": {
            const bytes = documents.get(path);
            if (!bytes) throw new Error(`Demo PDF not found: ${path}`);
            return bytes;
          }
          case "get_reading_progress":
            return readingProgress.get(path) ?? null;
          case "save_reading_progress":
            readingProgress.set(path, Number(args.page) || 1);
            return null;
          case "list_highlights":
            return [];
          case "save_highlight":
          case "delete_highlight":
            return null;
          default:
            throw new Error(`The browser demo vault is read-only (${command}).`);
        }
      },
    },
  });
}
