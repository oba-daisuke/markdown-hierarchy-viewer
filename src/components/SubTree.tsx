"use client";

import { useState } from "react";
import { FileNode, findNode } from "@/lib/fileTree";
import { extractFlatHeadings, FlatHeading } from "@/lib/markdown";
import DiagramView from "./DiagramView";

type ViewMode = "list" | "diagram";

interface Props {
  currentPath: string;
  fileTree: FileNode[];
  files: Map<string, string>;
  onNavigate: (path: string) => void;
  onNavigateToAnchor: (path: string, anchorId: string) => void;
}

export default function SubTree({
  currentPath,
  fileTree,
  files,
  onNavigate,
  onNavigateToAnchor,
}: Props) {
  const [viewMode, setViewMode] = useState<ViewMode>("list");

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
    <section className="mb-10 pb-8 border-b border-gray-200 dark:border-gray-700 not-prose">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-base">📂</span>
        <span className="text-sm font-semibold text-gray-600 dark:text-gray-300">
          {dirLabel} の構成
        </span>
        {/* View mode toggle */}
        <div className="ml-auto flex rounded-md border border-gray-200 dark:border-gray-700 overflow-hidden text-xs">
          <button
            onClick={() => setViewMode("list")}
            className={`px-2.5 py-1 transition-colors ${
              viewMode === "list"
                ? "bg-blue-600 text-white"
                : "bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700"
            }`}
          >
            リスト
          </button>
          <button
            onClick={() => setViewMode("diagram")}
            className={`px-2.5 py-1 transition-colors border-l border-gray-200 dark:border-gray-700 ${
              viewMode === "diagram"
                ? "bg-blue-600 text-white"
                : "bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700"
            }`}
          >
            図
          </button>
        </div>
      </div>

      {viewMode === "diagram" ? (
        <DiagramView
          dirPath={dirPath}
          dirLabel={dirLabel}
          children={children}
          currentPath={currentPath}
          files={files}
          onNavigate={onNavigate}
          onNavigateToAnchor={onNavigateToAnchor}
        />
      ) : (
        <NodeList
          nodes={children}
          currentPath={currentPath}
          files={files}
          onNavigate={onNavigate}
          onNavigateToAnchor={onNavigateToAnchor}
          depth={0}
        />
      )}
    </section>
  );
}

function NodeList({
  nodes,
  currentPath,
  files,
  onNavigate,
  onNavigateToAnchor,
  depth,
}: {
  nodes: FileNode[];
  currentPath: string;
  files: Map<string, string>;
  onNavigate: (path: string) => void;
  onNavigateToAnchor: (path: string, anchorId: string) => void;
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
        <NodeItem
          key={node.path}
          node={node}
          currentPath={currentPath}
          files={files}
          onNavigate={onNavigate}
          onNavigateToAnchor={onNavigateToAnchor}
          depth={depth}
        />
      ))}
    </div>
  );
}

function NodeItem({
  node,
  currentPath,
  files,
  onNavigate,
  onNavigateToAnchor,
  depth,
}: {
  node: FileNode;
  currentPath: string;
  files: Map<string, string>;
  onNavigate: (path: string) => void;
  onNavigateToAnchor: (path: string, anchorId: string) => void;
  depth: number;
}) {
  const isOnActivePath =
    currentPath === node.path ||
    currentPath.startsWith(node.path + "/") ||
    currentPath === node.path + "/";

  const [open, setOpen] = useState(isOnActivePath);

  if (node.isDir) {
    const indexContent =
      files.get(`${node.path}/README.md`) ??
      files.get(`${node.path}/INDEX.md`) ??
      "";
    const dirHeading = indexContent.match(/^#{1,6}\s+(.+)/m)?.[1]?.trim();

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
            onClick={() => { setOpen(true); onNavigate(node.path); }}
            className={`flex-1 text-left py-0.5 px-1 rounded transition-colors min-w-0 flex items-baseline gap-2
              ${isOnActivePath
                ? "text-blue-600 dark:text-blue-400"
                : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800"
              }`}
            title={node.path}
          >
            <span className="font-medium text-sm shrink-0">📁 {node.name}/</span>
            {dirHeading && (
              <span className="text-xs text-gray-400 dark:text-gray-500 truncate">
                {dirHeading}
              </span>
            )}
          </button>
        </div>
        {open && node.children.length > 0 && (
          <NodeList
            nodes={node.children}
            currentPath={currentPath}
            files={files}
            onNavigate={onNavigate}
            onNavigateToAnchor={onNavigateToAnchor}
            depth={depth + 1}
          />
        )}
      </div>
    );
  }

  // ── File node ────────────────────────────────────────────────
  const content = files.get(node.path) ?? "";
  const headings = extractFlatHeadings(content);
  const isCurrentFile = currentPath === node.path;
  const hasHeadings = headings.length > 0;

  // Default: expanded for current file, collapsed otherwise
  const [headingsOpen, setHeadingsOpen] = useState(isCurrentFile);

  const minLevel = hasHeadings ? Math.min(...headings.map((h) => h.level)) : 1;
  const firstHeading = headings[0]?.text;

  return (
    <div>
      <div className="flex items-center gap-1">
        {/* Toggle headings */}
        <button
          onClick={() => setHeadingsOpen((o) => !o)}
          className={`w-4 h-6 flex items-center justify-center shrink-0 transition-colors
            ${hasHeadings
              ? "text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              : "text-transparent cursor-default"
            }`}
          tabIndex={hasHeadings ? 0 : -1}
        >
          {hasHeadings && (
            <span className="text-[10px]">{headingsOpen ? "▾" : "▸"}</span>
          )}
        </button>

        {/* File name / title */}
        <button
          onClick={() => onNavigate(node.path)}
          className={`flex-1 text-left py-0.5 px-1 rounded transition-colors min-w-0 flex items-baseline gap-2
            ${isCurrentFile
              ? "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
              : "text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800"
            }`}
          title={node.path}
        >
          <span className="text-gray-400 shrink-0 text-xs leading-5">📄</span>
          <span className={`text-sm truncate ${isCurrentFile ? "font-medium" : ""}`}>
            {firstHeading ?? node.name}
          </span>
          {firstHeading && (
            <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0">
              {node.name}
            </span>
          )}
          {isCurrentFile && (
            <span className="text-[10px] text-blue-400 shrink-0 ml-auto">← 現在</span>
          )}
        </button>
      </div>

      {/* All headings */}
      {headingsOpen && hasHeadings && (
        <div className="ml-4 border-l-2 border-gray-100 dark:border-gray-700 pl-3 space-y-0.5 mt-0.5 mb-1">
          {headings.map((h, i) => (
            <HeadingRow
              key={i}
              heading={h}
              minLevel={minLevel}
              isCurrentFile={isCurrentFile}
              onNavigateToAnchor={() => onNavigateToAnchor(node.path, h.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function HeadingRow({
  heading,
  minLevel,
  isCurrentFile,
  onNavigateToAnchor,
}: {
  heading: FlatHeading;
  minLevel: number;
  isCurrentFile: boolean;
  onNavigateToAnchor: () => void;
}) {
  const indent = (heading.level - minLevel) * 12;

  return (
    <button
      onClick={onNavigateToAnchor}
      className="w-full text-left py-0.5 px-1 rounded text-xs text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors truncate"
      style={{ paddingLeft: `${indent + 4}px` }}
      title={heading.text}
    >
      <span className="text-gray-300 dark:text-gray-600 mr-1.5 font-mono">
        {"#".repeat(heading.level)}
      </span>
      {heading.text}
    </button>
  );
}
