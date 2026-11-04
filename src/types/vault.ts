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
  warnings: string[];
  hidden_items: { relative_path: string; name: string; is_folder: boolean }[];
}

export interface VaultSummary {
  name: string;
  path: string;
  file_count: number;
}
