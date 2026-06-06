"use client";

import { useState } from "react";
import { FileNode, findNode } from "@/lib/fileTree";

interface Props {
  currentPath: string;
  fileTree: FileNode[];
  files: Map<string, string>;
  onNavigate: (path: string) => void;
}

export default function SubTree({
  currentPath,
  fileTree,
  files,
  onNavigate,
}: Props) {
  if (fileTree.length === 0) return null;

  const isVirtual = currentPath.endsWith("/");
  const cleanPath = isVirtual ? currentPath.slice(0, -1) : currentPath;
  const dirPath = cleanPath.includes("/")
    ? cleanPath.slice(0, cleanPath.lastIndexOf("/"))
    : "";

  const subtreeNode = dirPath ? findNode(fileTree, dirPath) : null;
  const children = subtreeNode?.children ?? fileTree;

  if (children.length === 0) return null;

  const dirLabel = dirPath ? dirPath.split("/").pop() + "/" : "ルート/";

  return (
    <section className="mt-12 pt-8 border-t border-gray-200 dark:border-gray-700 not-prose">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-base">📂</span>
        <span className="text-sm font-semibold text-gray-600 dark:text-gray-300">
          {dirLabel} の構成
        </span>
      </div>
      <TreeNodeList
        nodes={children}
        currentPath={currentPath}
        files={files}
        onNavigate={onNavigate}
        depth={0}
      />
    </section>
  );
}

function TreeNodeList({
  nodes,
  currentPath,
  files,
  onNavigate,
  depth,
}: {
  nodes: FileNode[];
  currentPath: string;
  files: Map<string, string>;
  onNavigate: (path: string) => void;
  depth: number;
}) {
  return (
    <div
      className={
        depth > 0
          ? "ml-4 border-l-2 border-gray-100 dark:border-gray-700 pl-3 space-y-0.5"
          : "space-y-0.5"
      }
    >
      {nodes.map((node) => (
        <TreeNodeItem
          key={node.path}
          node={node}
          currentPath={currentPath}
          files={files}
          onNavigate={onNavigate}
          depth={depth}
        />
      ))}
    </div>
  );
}

function fileHeading(content: string): string | null {
  return content.match(/^#{1,6}\s+(.+)/m)?.[1]?.trim() ?? null;
}

function TreeNodeItem({
  node,
  currentPath,
  files,
  onNavigate,
  depth,
}: {
  node: FileNode;
  currentPath: string;
  files: Map<string, string>;
  onNavigate: (path: string) => void;
  depth: number;
}) {
  const isOnActivePath =
    currentPath === node.path ||
    currentPath.startsWith(node.path + "/") ||
    currentPath === node.path + "/";

  const [open, setOpen] = useState(isOnActivePath);

  if (node.isDir) {
    // Use the heading of the directory's README/INDEX as the dir label
    const indexContent =
      files.get(`${node.path}/README.md`) ??
      files.get(`${node.path}/INDEX.md`) ??
      "";
    const heading = fileHeading(indexContent);

    return (
      <div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setOpen((o) => !o)}
            className="w-4 h-6 flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 shrink-0 transition-colors"
          >
            <span className="text-[10px]">{open ? "▾" : "▸"}</span>
          </button>
          <button
            onClick={() => {
              setOpen(true);
              onNavigate(node.path);
            }}
            className={`flex-1 text-left py-0.5 px-1 rounded transition-colors min-w-0
              ${
                isOnActivePath
                  ? "text-blue-600 dark:text-blue-400"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800"
              }`}
            title={node.path}
          >
            <span className="flex items-baseline gap-2 min-w-0">
              <span className="font-medium text-sm shrink-0">
                📁 {node.name}/
              </span>
              {heading && (
                <span className="text-xs text-gray-400 dark:text-gray-500 truncate">
                  {heading}
                </span>
              )}
            </span>
          </button>
        </div>
        {open && node.children.length > 0 && (
          <TreeNodeList
            nodes={node.children}
            currentPath={currentPath}
            files={files}
            onNavigate={onNavigate}
            depth={depth + 1}
          />
        )}
      </div>
    );
  }

  // File: show heading as main label, filename as secondary
  const content = files.get(node.path) ?? "";
  const heading = fileHeading(content);
  const isCurrentFile = currentPath === node.path;

  return (
    <button
      onClick={() => onNavigate(node.path)}
      className={`w-full text-left flex items-baseline gap-2 py-0.5 px-1 rounded transition-colors min-w-0
        ${
          isCurrentFile
            ? "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
            : "text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800"
        }`}
      title={node.path}
    >
      <span className="text-gray-400 shrink-0 text-xs leading-5">📄</span>
      <span className="flex items-baseline gap-2 min-w-0 flex-1">
        <span
          className={`text-sm truncate ${isCurrentFile ? "font-medium" : ""}`}
        >
          {heading ?? node.name}
        </span>
        {heading && (
          <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0">
            {node.name}
          </span>
        )}
      </span>
      {isCurrentFile && (
        <span className="text-[10px] text-blue-400 shrink-0">← 現在</span>
      )}
    </button>
  );
}
