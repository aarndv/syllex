export type HighlightColor = "gold" | "mint" | "rose" | "blue" | "violet";

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
