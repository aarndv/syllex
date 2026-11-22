import type { DocumentViewMode } from "../components/PdfViewer";
import type { HighlightColor } from "./highlight";
import type { VaultNode } from "./vault";
import type { WorkspaceLayout } from "../utils/workspaceLayout";

export interface WorkspacePaneState {
  id: string;
  node: VaultNode;
  page: number;
  numPages?: number;
  zoom: number;
  fitWidth: boolean;
  fitHeight: boolean;
  continuous: boolean;
  viewMode: DocumentViewMode;
  highlightEnabled: boolean;
  erasingHighlights: boolean;
  highlightColor: HighlightColor;
}

export interface WorkspaceState {
  layout: WorkspaceLayout | null;
  panes: Record<string, WorkspacePaneState>;
  selectedPaneId: string | null;
}

export const EMPTY_WORKSPACE: WorkspaceState = {
  layout: null,
  panes: {},
  selectedPaneId: null,
};
