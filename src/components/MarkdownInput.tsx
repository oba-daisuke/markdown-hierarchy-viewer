"use client";

import { useRef } from "react";

interface Props {
  value: string;
  onChange: (val: string) => void;
}

export default function MarkdownInput({ value, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith(".md")) {
      readFile(file);
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) readFile(file);
  }

  function readFile(file: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      onChange(text);
    };
    reader.readAsText(file);
  }

  return (
    <div className="flex gap-2 items-center">
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className="flex-1 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 text-center text-sm text-gray-500 dark:text-gray-400 cursor-pointer hover:border-blue-400 transition-colors"
      >
        Markdownファイルをドロップ、またはクリックして選択
      </div>
      <input
        ref={inputRef}
        type="file"
        accept=".md,.markdown"
        className="hidden"
        onChange={handleFileSelect}
      />
      {value && (
        <button
          onClick={() => onChange("")}
          className="text-xs text-gray-400 hover:text-red-400 transition-colors"
        >
          クリア
        </button>
      )}
    </div>
  );
}
