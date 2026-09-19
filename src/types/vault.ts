export type ModuleFileType = 'Pdf' | 'Ppt' | 'Pptx' | 'Md';

export type VaultNodeType = { File: ModuleFileType } | 'Folder';

export interface VaultNode {
  name: string;
  relative_path: string;
  node_type: VaultNodeType;
  size_bytes?: number;
  children: VaultNode[];
}

export interface VaultScanResult {
  root_path: string;
  root_nodes: VaultNode[];
}

export interface VaultSummary {
  name: string;
  path: string;
  file_count: number;
}
