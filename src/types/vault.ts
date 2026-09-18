export type ModuleFileType = 'Pdf' | 'Ppt' | 'Pptx' | 'Md';

export interface ModuleItem {
  relative_path: string;
  file_name: string;
  file_type: ModuleFileType;
  size_bytes: number;
}

export interface CourseItem {
  name: string;
  relative_path: string;
  modules: ModuleItem[];
}

export interface VaultScanResult {
  root_path: string;
  courses: CourseItem[];
  root_modules: ModuleItem[];
}
