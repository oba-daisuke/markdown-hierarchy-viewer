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
  const indent = depth * 14 + 8;

  if (node.isDir) {
    return (
      <li>
        <button
          onClick={() => setOpen((o) => !o)}
          className="w-full text-left flex items-center gap-1 py-0.5 text-xs font-semibold text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 rounded transition-colors"
          style={{ paddingLeft: `${indent}px` }}
        >
          <span className="text-gray-400 w-3 shrink-0">
            {open ? "▾" : "▸"}
          </span>
          <span className="truncate">{node.name}/</span>
        </button>
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
        className={`w-full text-left py-0.5 text-xs rounded truncate transition-colors flex items-center gap-1
          ${
            isActive
              ? "bg-blue-100 text-blue-700 font-medium dark:bg-blue-900/50 dark:text-blue-300"
              : "text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700/50"
          }`}
        style={{ paddingLeft: `${indent}px` }}
        title={node.path}
      >
        <span className="text-gray-400 shrink-0">
          {node.name.endsWith(".md") ? "📄" : "·"}
        </span>
        <span className="truncate">{node.name}</span>
      </button>
    </li>
  );
}
