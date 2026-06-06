"use client";

import { useState } from "react";
import { FileNode } from "@/lib/fileTree";

interface Props {
  nodes: FileNode[];
  currentPath: string;
  onSelect: (path: string) => void;
  depth?: number;
}

export default function FileTree({
  nodes,
  currentPath,
  onSelect,
  depth = 0,
}: Props) {
  return (
    <ul className="space-y-px">
      {nodes.map((node) => (
        <Node
          key={node.path}
          node={node}
          currentPath={currentPath}
          onSelect={onSelect}
          depth={depth}
        />
      ))}
    </ul>
  );
}

function Node({
  node,
  currentPath,
  onSelect,
  depth,
}: {
  node: FileNode;
  currentPath: string;
  onSelect: (path: string) => void;
  depth: number;
}) {
  const [open, setOpen] = useState(true);
  const indent = depth * 14 + 4;

  if (node.isDir) {
    // Highlight if we're currently inside this directory
    const isActive =
      currentPath === node.path ||
      currentPath.startsWith(node.path + "/") ||
      currentPath === node.path + "/";

    return (
      <li>
        <div
          className="flex items-center gap-0.5"
          style={{ paddingLeft: `${indent}px` }}
        >
          {/* Expand / collapse toggle */}
          <button
            onClick={() => setOpen((o) => !o)}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 shrink-0 rounded transition-colors"
            title={open ? "閉じる" : "開く"}
          >
            <span className="text-[10px] leading-none">
              {open ? "▾" : "▸"}
            </span>
          </button>
          {/* Directory name — navigates to its README/INDEX or virtual page */}
          <button
            onClick={() => onSelect(node.path)}
            className={`flex-1 text-left py-0.5 pr-2 text-xs font-medium rounded truncate transition-colors
              ${
                isActive
                  ? "text-blue-600 dark:text-blue-400"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
              }`}
            title={node.path}
          >
            {node.name}/
          </button>
        </div>
        {open && node.children.length > 0 && (
          <FileTree
            nodes={node.children}
            currentPath={currentPath}
            onSelect={onSelect}
            depth={depth + 1}
          />
        )}
      </li>
    );
  }

  const isActive = currentPath === node.path;
  return (
    <li>
      <button
        onClick={() => onSelect(node.path)}
        className={`w-full text-left py-0.5 pr-2 text-xs rounded truncate transition-colors flex items-center gap-1
          ${
            isActive
              ? "bg-blue-100 text-blue-700 font-medium dark:bg-blue-900/50 dark:text-blue-300"
              : "text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700/50"
          }`}
        style={{ paddingLeft: `${indent + 20}px` }}
        title={node.path}
      >
        <span className="shrink-0 opacity-50">·</span>
        <span className="truncate">{node.name}</span>
      </button>
    </li>
  );
}
