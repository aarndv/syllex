import type { DocumentViewMode } from "../components/PdfViewer";
import type { VaultNode } from "./vault";
import type { WorkspaceLayout } from "../utils/workspaceLayout";

export interface WorkspacePaneState {
  id: string;
  node: VaultNode;
  page: number;
  numPages?: number;
  zoom: number;
  fitWidth: boolean;
  continuous: boolean;
  viewMode: DocumentViewMode;
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
