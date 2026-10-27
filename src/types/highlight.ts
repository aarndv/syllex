export const HIGHLIGHT_COLORS = [
  { id: "gold", label: "Gold", swatch: "#f3c65b" },
  { id: "yellow", label: "Yellow", swatch: "#ffe150" },
  { id: "orange", label: "Orange", swatch: "#f4a24e" },
  { id: "rose", label: "Rose", swatch: "#ef9aaa" },
  { id: "pink", label: "Pink", swatch: "#f99bd8" },
  { id: "mint", label: "Mint", swatch: "#75d9a5" },
  { id: "lime", label: "Lime", swatch: "#c4e76a" },
  { id: "teal", label: "Teal", swatch: "#6ad5cd" },
  { id: "blue", label: "Blue", swatch: "#82b9ed" },
  { id: "violet", label: "Violet", swatch: "#c2a5ef" },
] as const;

export type HighlightColor = typeof HIGHLIGHT_COLORS[number]["id"];

export interface HighlightRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Highlight {
  id: string;
  page_number: number;
  color: HighlightColor;
  rects: HighlightRect[];
}

export interface HighlightFocus {
  id: string;
  pageNumber: number;
  sequence: number;
}
