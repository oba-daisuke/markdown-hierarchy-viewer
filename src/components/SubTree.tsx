"use client";

import { useState } from "react";
import { FileNode, findNode } from "@/lib/fileTree";

interface Props {
  currentPath: string;
  fileTree: FileNode[];
  onNavigate: (path: string) => void;
}

export default function SubTree({ currentPath, fileTree, onNavigate }: Props) {
  if (fileTree.length === 0) return null;

  // Parent directory of the current page
  const isVirtual = currentPath.endsWith("/");
  const cleanPath = isVirtual ? currentPath.slice(0, -1) : currentPath;
  const dirPath = cleanPath.includes("/")
    ? cleanPath.slice(0, cleanPath.lastIndexOf("/"))
    : "";

  const subtreeNode = dirPath ? findNode(fileTree, dirPath) : null;
  const children = subtreeNode?.children ?? fileTree;

  if (children.length === 0) return null;

  const dirLabel = dirPath
    ? dirPath.split("/").pop() + "/"
    : "ルート/";

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
        onNavigate={onNavigate}
        ancestorPath={dirPath}
        depth={0}
      />
    </section>
  );
}

function TreeNodeList({
  nodes,
  currentPath,
  onNavigate,
  ancestorPath,
  depth,
}: {
  nodes: FileNode[];
  currentPath: string;
  onNavigate: (path: string) => void;
  ancestorPath: string;
  depth: number;
}) {
  return (
    <div
      className={
        depth > 0
          ? "ml-4 border-l-2 border-gray-100 dark:border-gray-700 pl-2 space-y-0.5"
          : "space-y-0.5"
      }
    >
      {nodes.map((node) => (
        <TreeNodeItem
          key={node.path}
          node={node}
          currentPath={currentPath}
          onNavigate={onNavigate}
          ancestorPath={ancestorPath}
          depth={depth}
        />
      ))}
    </div>
  );
}

function TreeNodeItem({
  node,
  currentPath,
  onNavigate,
  ancestorPath,
  depth,
}: {
  node: FileNode;
  currentPath: string;
  onNavigate: (path: string) => void;
  ancestorPath: string;
  depth: number;
}) {
  // Auto-expand if this dir is in the active path
  const isOnActivePath =
    currentPath === node.path ||
    currentPath.startsWith(node.path + "/") ||
    currentPath === node.path + "/";

  const [open, setOpen] = useState(isOnActivePath);

  if (node.isDir) {
    return (
      <div>
        <div className="flex items-center gap-1 group">
          {/* Expand/collapse toggle */}
          <button
            onClick={() => setOpen((o) => !o)}
            className="w-4 h-5 flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 shrink-0 transition-colors"
          >
            <span className="text-[10px]">{open ? "▾" : "▸"}</span>
          </button>
          {/* Directory link */}
          <button
            onClick={() => {
              setOpen(true);
              onNavigate(node.path);
            }}
            className={`flex-1 text-left text-sm py-0.5 rounded px-1 truncate transition-colors font-medium
              ${
                isOnActivePath
                  ? "text-blue-600 dark:text-blue-400"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800"
              }`}
            title={node.path}
          >
            📁 {node.name}/
          </button>
        </div>
        {open && node.children.length > 0 && (
          <TreeNodeList
            nodes={node.children}
            currentPath={currentPath}
            onNavigate={onNavigate}
            ancestorPath={node.path}
            depth={depth + 1}
          />
        )}
      </div>
    );
  }

  const isCurrentFile =
    currentPath === node.path ||
    // also match when viewing virtual dir but this file is the "active" one
    false;

  return (
    <button
      onClick={() => onNavigate(node.path)}
      className={`w-full text-left flex items-center gap-1.5 text-sm py-0.5 px-1 rounded truncate transition-colors
        ${
          isCurrentFile
            ? "bg-blue-50 text-blue-700 font-medium dark:bg-blue-900/30 dark:text-blue-300"
            : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800"
        }`}
      title={node.path}
    >
      <span className="text-gray-400 shrink-0 text-xs">📄</span>
      <span className="truncate">{node.name}</span>
      {isCurrentFile && (
        <span className="ml-auto text-[10px] text-blue-400 shrink-0">← 現在</span>
      )}
    </button>
  );
}
