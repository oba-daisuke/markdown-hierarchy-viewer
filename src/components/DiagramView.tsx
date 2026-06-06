"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { FileNode } from "@/lib/fileTree";
import { extractFlatHeadings, FlatHeading } from "@/lib/markdown";

// ── Layout constants ───────────────────────────────────────────
const NW = 210;        // node width (px)
const NH_HDR = 34;     // header height
const NH_LINE = 21;    // body line height
const NH_PAD = 8;      // body top+bottom padding
const H_GAP = 52;      // horizontal gap between sibling subtrees
const V_GAP = 60;      // vertical gap between levels
const CANVAS_PAD = 24; // canvas padding

// ── Types ──────────────────────────────────────────────────────
interface LayoutNode {
  node: FileNode;
  x: number;
  y: number;
  h: number;  // own height
  sw: number; // subtree width
  children: LayoutNode[];
}

// ── Props ──────────────────────────────────────────────────────
interface DiagramProps {
  dirPath: string;     // current directory path ("" for root)
  dirLabel: string;    // display label e.g. "projects/"
  children: FileNode[];
  currentPath: string;
  files: Map<string, string>;
  onNavigate: (path: string) => void;
  onNavigateToAnchor: (path: string, anchorId: string) => void;
}

// ── Main component ─────────────────────────────────────────────
export default function DiagramView({
  dirPath,
  dirLabel,
  children,
  currentPath,
  files,
  onNavigate,
  onNavigateToAnchor,
}: DiagramProps) {
  const rootPath = dirPath || "__root__";

  // Expanded directories (children rendered as sub-boxes)
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(() => {
    const s = new Set<string>([rootPath]);
    // Auto-expand dirs along the current path
    const parts = currentPath.replace(/\/$/, "").split("/");
    for (let i = 1; i < parts.length; i++) {
      s.add(parts.slice(0, i).join("/"));
    }
    return s;
  });

  // Files with headings visible inside their box
  const [showHeadings, setShowHeadings] = useState<Set<string>>(() => {
    const s = new Set<string>();
    if (!currentPath.endsWith("/")) s.add(currentPath);
    return s;
  });

  // Virtual root node for the current directory
  const virtualRoot = useMemo<FileNode>(
    () => ({ name: dirLabel, path: rootPath, isDir: true, children }),
    [dirLabel, rootPath, children]
  );

  // Compute layout tree
  const layoutRoot = useMemo(
    () => buildLayout(virtualRoot, expandedDirs, showHeadings, files, 0, 0),
    [virtualRoot, expandedDirs, showHeadings, files]
  );

  const allNodes = useMemo(() => flattenLayout(layoutRoot), [layoutRoot]);
  const edges = useMemo(() => collectEdges(layoutRoot), [layoutRoot]);

  const canvasW = layoutRoot.sw + CANVAS_PAD * 2;
  const maxY = Math.max(...allNodes.map((n) => n.y + n.h));
  const canvasH = maxY + CANVAS_PAD * 2;

  // Auto-scale to fit container width — no scroll
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerW, setContainerW] = useState(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setContainerW(entry.contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const scale = containerW > 0 && canvasW > 0
    ? Math.min(1, containerW / canvasW)
    : 1;
  const displayH = Math.ceil(canvasH * scale);

  function toggleDir(path: string) {
    setExpandedDirs((prev) => {
      const next = new Set(prev);
      next.has(path) ? next.delete(path) : next.add(path);
      return next;
    });
  }

  function toggleHeadings(path: string) {
    setShowHeadings((prev) => {
      const next = new Set(prev);
      next.has(path) ? next.delete(path) : next.add(path);
      return next;
    });
  }

  function handleNavigate(path: string) {
    onNavigate(path === rootPath ? dirPath : path);
  }

  return (
    <div
      ref={containerRef}
      className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30 overflow-hidden"
      style={{ height: displayH || undefined }}
    >
      <div
        style={{
          width: canvasW,
          height: canvasH,
          position: "relative",
          transform: scale < 1 ? `scale(${scale})` : undefined,
          transformOrigin: "top left",
        }}
      >
        {/* SVG connector lines */}
        <svg
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: canvasW,
            height: canvasH,
            pointerEvents: "none",
            overflow: "visible",
          }}
        >
          <defs>
            <marker
              id="arrow"
              markerWidth="6"
              markerHeight="4"
              refX="5"
              refY="2"
              orient="auto"
            >
              <polygon points="0 0, 6 2, 0 4" fill="#9ca3af" />
            </marker>
          </defs>
          {edges.map((e, i) => {
            const mx = (e.x1 + e.x2) / 2;
            const my = (e.y1 + e.y2) / 2;
            return (
              <path
                key={i}
                d={`M ${e.x1} ${e.y1} C ${e.x1} ${my}, ${e.x2} ${my}, ${e.x2} ${e.y2}`}
                fill="none"
                stroke="#d1d5db"
                strokeWidth="1.5"
                markerEnd="url(#arrow)"
              />
            );
          })}
        </svg>

        {/* Node boxes */}
        {allNodes.map(({ node, x, y, h }) => (
          <NodeBox
            key={node.path}
            node={node}
            x={x + CANVAS_PAD}
            y={y + CANVAS_PAD}
            h={h}
            files={files}
            currentPath={currentPath}
            expandedDirs={expandedDirs}
            showHeadings={showHeadings}
            onNavigate={handleNavigate}
            onNavigateToAnchor={onNavigateToAnchor}
            onToggleDir={toggleDir}
            onToggleHeadings={toggleHeadings}
          />
        ))}
      </div>
    </div>
  );
}

// ── Layout algorithm ───────────────────────────────────────────

function subtreeWidth(node: FileNode, expandedDirs: Set<string>): number {
  if (!node.isDir || !expandedDirs.has(node.path) || node.children.length === 0)
    return NW;
  const childW = node.children.map((c) => subtreeWidth(c, expandedDirs));
  const total =
    childW.reduce((a, b) => a + b, 0) + H_GAP * (node.children.length - 1);
  return Math.max(NW, total);
}

function nodeHeight(
  node: FileNode,
  showHeadings: Set<string>,
  files: Map<string, string>
): number {
  if (!node.isDir && showHeadings.has(node.path)) {
    const hs = extractFlatHeadings(files.get(node.path) ?? "");
    if (hs.length > 0) return NH_HDR + NH_PAD + hs.length * NH_LINE + NH_PAD;
  }
  return NH_HDR + NH_PAD + NH_LINE + NH_PAD;
}

function buildLayout(
  node: FileNode,
  expandedDirs: Set<string>,
  showHeadings: Set<string>,
  files: Map<string, string>,
  offsetX: number,
  offsetY: number
): LayoutNode {
  const h = nodeHeight(node, showHeadings, files);
  const sw = subtreeWidth(node, expandedDirs);
  const nodeX = offsetX + (sw - NW) / 2;

  const childrenShown =
    node.isDir && expandedDirs.has(node.path) && node.children.length > 0;

  if (!childrenShown) {
    return { node, x: nodeX, y: offsetY, h, sw, children: [] };
  }

  const childY = offsetY + h + V_GAP;
  const childSWs = node.children.map((c) => subtreeWidth(c, expandedDirs));
  const totalChildW =
    childSWs.reduce((a, b) => a + b, 0) +
    H_GAP * (node.children.length - 1);

  let cx = offsetX + (sw - totalChildW) / 2;
  const childLayouts = node.children.map((child, i) => {
    const layout = buildLayout(
      child,
      expandedDirs,
      showHeadings,
      files,
      cx,
      childY
    );
    cx += childSWs[i] + H_GAP;
    return layout;
  });

  return { node, x: nodeX, y: offsetY, h, sw, children: childLayouts };
}

function flattenLayout(root: LayoutNode): LayoutNode[] {
  const result: LayoutNode[] = [root];
  for (const child of root.children) result.push(...flattenLayout(child));
  return result;
}

function collectEdges(root: LayoutNode) {
  const edges: { x1: number; y1: number; x2: number; y2: number }[] = [];
  function walk(n: LayoutNode) {
    const x1 = n.x + CANVAS_PAD + NW / 2;
    const y1 = n.y + CANVAS_PAD + n.h;
    for (const child of n.children) {
      edges.push({ x1, y1, x2: child.x + CANVAS_PAD + NW / 2, y2: child.y + CANVAS_PAD });
      walk(child);
    }
  }
  walk(root);
  return edges;
}

// ── Node box ───────────────────────────────────────────────────

function NodeBox({
  node, x, y, h, files, currentPath,
  expandedDirs, showHeadings,
  onNavigate, onNavigateToAnchor, onToggleDir, onToggleHeadings,
}: {
  node: FileNode;
  x: number; y: number; h: number;
  files: Map<string, string>;
  currentPath: string;
  expandedDirs: Set<string>;
  showHeadings: Set<string>;
  onNavigate: (path: string) => void;
  onNavigateToAnchor: (path: string, id: string) => void;
  onToggleDir: (path: string) => void;
  onToggleHeadings: (path: string) => void;
}) {
  const isCurrentFile = currentPath === node.path;
  const isDirExpanded = node.isDir && expandedDirs.has(node.path);
  const headingsShown = !node.isDir && showHeadings.has(node.path);

  const content = files.get(node.path) ?? "";
  const allHeadings = !node.isDir && headingsShown
    ? extractFlatHeadings(content)
    : [];
  const firstHeading = !node.isDir
    ? (extractFlatHeadings(content)[0]?.text ?? node.name)
    : null;
  const minLevel =
    allHeadings.length > 0
      ? Math.min(...allHeadings.map((h) => h.level))
      : 1;

  const headerColor = node.isDir
    ? "bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600"
    : isCurrentFile
    ? "bg-blue-500 hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-500"
    : "bg-slate-500 hover:bg-slate-600 dark:bg-slate-600 dark:hover:bg-slate-500";

  function handleHeader() {
    if (node.isDir) {
      onToggleDir(node.path);
      onNavigate(node.path);
    } else {
      onToggleHeadings(node.path);
      onNavigate(node.path);
    }
  }

  return (
    <div
      style={{ position: "absolute", left: x, top: y, width: NW }}
      className="rounded-lg shadow border border-gray-200 dark:border-gray-600 overflow-hidden select-none"
    >
      {/* ── Header (UML class name section) ── */}
      <button
        className={`w-full flex items-center gap-1.5 px-3 text-white transition-colors ${headerColor}`}
        style={{ height: NH_HDR }}
        onClick={handleHeader}
        title={node.path}
      >
        <span className="text-xs shrink-0">{node.isDir ? "📁" : "📄"}</span>
        <span className="text-xs font-semibold truncate flex-1 text-left">
          {node.name}{node.isDir ? "/" : ""}
        </span>
        <span className="text-xs opacity-70 shrink-0 font-mono">
          {node.isDir
            ? isDirExpanded ? "▾" : "▸"
            : headingsShown ? "▾" : "▸"}
        </span>
      </button>

      {/* ── Divider ── */}
      <div className="border-t border-gray-200 dark:border-gray-600" />

      {/* ── Body (UML attributes section) ── */}
      <div className="bg-white dark:bg-gray-800 px-2 py-1.5">
        {node.isDir ? (
          // Directory: show counts
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {node.children.filter((c) => c.isDir).length > 0 && (
              <span className="mr-3">
                📁 {node.children.filter((c) => c.isDir).length}
              </span>
            )}
            <span>📄 {node.children.filter((c) => !c.isDir).length}</span>
          </div>
        ) : headingsShown && allHeadings.length > 0 ? (
          // File expanded: all headings
          <div>
            {allHeadings.map((heading, i) => (
              <button
                key={i}
                onClick={(e) => {
                  e.stopPropagation();
                  onNavigateToAnchor(node.path, heading.id);
                }}
                className="w-full text-left text-xs py-px text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors truncate"
                style={{ paddingLeft: (heading.level - minLevel) * 10 + 2 }}
                title={heading.text}
              >
                <span className="font-mono text-gray-300 dark:text-gray-500 mr-1">
                  {"#".repeat(heading.level)}
                </span>
                {heading.text}
              </button>
            ))}
          </div>
        ) : (
          // File collapsed: first heading only
          <button
            className="w-full text-left text-xs text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 truncate transition-colors"
            onClick={handleHeader}
            title={firstHeading ?? ""}
          >
            {firstHeading}
          </button>
        )}
      </div>
    </div>
  );
}
