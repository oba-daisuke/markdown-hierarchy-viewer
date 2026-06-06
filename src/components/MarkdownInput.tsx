"use client";

import { useRef } from "react";
import {
  FileEntry,
  readDirectoryEntries,
} from "@/lib/fileTree";

interface Props {
  loadedInfo?: string;
  onLoadFile: (entry: FileEntry) => void;
  onLoadDirectory: (entries: FileEntry[]) => void;
  onClear: () => void;
}

export default function MarkdownInput({
  loadedInfo,
  onLoadFile,
  onLoadDirectory,
  onClear,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const dirRef = useRef<HTMLInputElement>(null);

  async function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const items = Array.from(e.dataTransfer.items);

    // Try directory first
    for (const item of items) {
      const entry = item.webkitGetAsEntry?.();
      if (entry?.isDirectory) {
        const files = await readDirectoryEntries(
          entry as FileSystemDirectoryEntry
        );
        if (files.length > 0) onLoadDirectory(files);
        return;
      }
    }

    // Single file fallback
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith(".md")) {
      const content = await file.text();
      onLoadFile({ path: file.name, content });
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;

    const first = files[0] as File;
    if (files.length === 1 && !first.webkitRelativePath) {
      const content = await first.text();
      onLoadFile({ path: first.name, content });
    } else {
      // Directory upload — strip the root folder prefix
      const prefix = files[0].webkitRelativePath.split("/")[0] + "/";
      const entries: FileEntry[] = await Promise.all(
        files
          .filter((f) => f.name.endsWith(".md") && !f.name.startsWith("."))
          .map(async (f) => ({
            path: f.webkitRelativePath.replace(prefix, ""),
            content: await f.text(),
          }))
      );
      if (entries.length > 0) onLoadDirectory(entries);
    }

    // Reset so same path can be re-selected
    e.target.value = "";
  }

  return (
    <div className="flex items-center gap-2">
      {loadedInfo ? (
        <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 rounded px-3 py-1.5">
          <span className="max-w-48 truncate">{loadedInfo}</span>
          <button
            onClick={onClear}
            className="text-gray-400 hover:text-red-400 transition-colors shrink-0"
            title="クリア"
          >
            ✕
          </button>
        </div>
      ) : (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          className="text-xs text-gray-500 dark:text-gray-400 border border-dashed border-gray-300 dark:border-gray-600 rounded px-3 py-1.5 cursor-default hover:border-blue-400 transition-colors"
        >
          ファイル / フォルダをドロップ
        </div>
      )}

      <button
        onClick={() => fileRef.current?.click()}
        className="text-xs px-2 py-1.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors shrink-0"
      >
        ファイル
      </button>
      <button
        onClick={() => dirRef.current?.click()}
        className="text-xs px-2 py-1.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors shrink-0"
      >
        フォルダ
      </button>

      <input
        ref={fileRef}
        type="file"
        accept=".md,.markdown"
        className="hidden"
        onChange={handleFileChange}
      />
      <input
        ref={dirRef}
        type="file"
        // @ts-ignore webkitdirectory is a non-standard attribute
        webkitdirectory=""
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  );
}
