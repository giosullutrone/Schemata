/// <reference types="vite/client" />

// File System Access API types
interface FileSystemFileHandle {
  getFile(): Promise<File>;
  createWritable(): Promise<FileSystemWritableFileStream>;
}

interface FileSystemWritableFileStream extends WritableStream {
  write(data: string | BufferSource | Blob): Promise<void>;
  close(): Promise<void>;
}

interface Window {
  showSaveFilePicker(options?: {
    suggestedName?: string;
    types?: { description: string; accept: Record<string, string[]> }[];
  }): Promise<FileSystemFileHandle>;
  showOpenFilePicker(options?: {
    types?: { description: string; accept: Record<string, string[]> }[];
  }): Promise<FileSystemFileHandle[]>;
}
