"use client";

import { HeadingNode } from "@/lib/markdown";

interface Props {
  headings: HeadingNode[];
  activeId: string;
  onSelect: (id: string) => void;
}

export default function TableOfContents({ headings, activeId, onSelect }: Props) {
  return (
    <nav className="text-sm">
      <TreeNodes nodes={headings} activeId={activeId} onSelect={onSelect} depth={0} />
    </nav>
  );
}

function TreeNodes({
  nodes,
  activeId,
  onSelect,
  depth,
}: {
  nodes: HeadingNode[];
  activeId: string;
  onSelect: (id: string) => void;
  depth: number;
}) {
  return (
    <ul className="space-y-0.5">
      {nodes.map((node) => (
        <li key={node.id}>
          <button
            onClick={() => onSelect(node.id)}
            className={`w-full text-left px-2 py-1 rounded transition-colors truncate
              ${depth === 0 ? "font-semibold" : "font-normal"}
              ${
                activeId === node.id
                  ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                  : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
              }`}
            style={{ paddingLeft: `${depth * 12 + 8}px` }}
            title={node.text}
          >
            <span className="text-gray-400 mr-1">{"#".repeat(node.level)}</span>
            {node.text}
          </button>
          {node.children.length > 0 && (
            <TreeNodes
              nodes={node.children}
              activeId={activeId}
              onSelect={onSelect}
              depth={depth + 1}
            />
          )}
        </li>
      ))}
    </ul>
  );
}
