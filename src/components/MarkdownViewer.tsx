"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { renderMarkdown, extractHeadings, HeadingNode } from "@/lib/markdown";
import {
  FileEntry,
  FileNode,
  buildFileTree,
  resolveRelativePath,
  findDefaultFile,
} from "@/lib/fileTree";
import TableOfContents from "./TableOfContents";
import FileTree from "./FileTree";
import MarkdownInput from "./MarkdownInput";

const SAMPLE: FileEntry = {
  path: "sample.md",
  content: `# プロジェクト管理システム

> 最終更新: 2026-06-06

## 概要

このディレクトリは仕事のプロジェクトを体系的に管理するための Markdown 階層です。

## 構成

| セクション | 説明 |
|-----------|------|
| projects/ | 進行中・完了プロジェクト一覧 |
| weekly/ | 週次レポート・振り返り |

## 進行中プロジェクト

| プロジェクト | 状態 | 担当 | 期限 |
|------------|------|------|------|
| ECサイトリニューアル | 🟡 進行中 | 開発チーム | 2026-07-31 |
| 社内BI基盤構築 | 🟢 順調 | データチーム | 2026-09-30 |
| モバイルアプリv2 | 🔴 遅延リスク | 全体 | 2026-06-30 |

## 今週のフォーカス

- [ ] Q3 ロードマップ最終確認
- [ ] 顧客提案書レビュー
- [x] チームスプリント計画

## コードブロック例

\`\`\`typescript
function greet(name: string): string {
  return \`Hello, \${name}!\`;
}
\`\`\`

### ネスト見出し

#### h4 レベル

##### h5 レベル

###### h6 レベルまで対応
`,
};

type SidebarTab = "files" | "toc";

export default function MarkdownViewer() {
  const [files, setFiles] = useState<Map<string, string>>(
    new Map([[SAMPLE.path, SAMPLE.content]])
  );
  const [fileTree, setFileTree] = useState<FileNode[]>([]);
  const [currentPath, setCurrentPath] = useState(SAMPLE.path);
  const [html, setHtml] = useState("");
  const [headings, setHeadings] = useState<HeadingNode[]>([]);
  const [activeId, setActiveId] = useState("");
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>("toc");
  const [showEditor, setShowEditor] = useState(false);
  const [editorValue, setEditorValue] = useState(SAMPLE.content);
  const [loadedLabel, setLoadedLabel] = useState<string | undefined>();

  const contentRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Render current file
  useEffect(() => {
    const content = files.get(currentPath) ?? "";
    renderMarkdown(content).then(setHtml);
    setHeadings(extractHeadings(content));
    setEditorValue(content);
    setActiveId("");
  }, [currentPath, files]);

  // Scroll-spy for active heading
  useEffect(() => {
    if (!contentRef.current) return;
    observerRef.current?.disconnect();

    const els = contentRef.current.querySelectorAll(
      "h1[id],h2[id],h3[id],h4[id],h5[id],h6[id]"
    );

    observerRef.current = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length > 0) setActiveId(visible[0].target.id);
      },
      { rootMargin: "-10% 0px -80% 0px" }
    );

    els.forEach((el) => observerRef.current!.observe(el));
    return () => observerRef.current?.disconnect();
  }, [html]);

  function scrollToHeading(id: string) {
    const el = contentRef.current?.querySelector(`#${id}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      setActiveId(id);
    }
  }

  function navigateTo(path: string) {
    if (files.has(path)) {
      setCurrentPath(path);
      contentRef.current?.scrollTo({ top: 0 });
    }
  }

  // Intercept clicks inside rendered markdown
  const handleContentClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const anchor = (e.target as HTMLElement).closest("a");
      if (!anchor) return;

      const href = anchor.getAttribute("href");
      if (!href) return;

      // External links: open in new tab (let default handle)
      if (href.startsWith("http") || href.startsWith("mailto:")) return;

      e.preventDefault();

      // Anchor-only link: scroll within page
      if (href.startsWith("#")) {
        const id = href.slice(1);
        const el = contentRef.current?.querySelector(`#${id}`);
        el?.scrollIntoView({ behavior: "smooth" });
        return;
      }

      // Relative link: resolve and navigate
      const resolved = resolveRelativePath(currentPath, href);
      if (!resolved) return;

      // Try exact match first
      if (files.has(resolved)) {
        navigateTo(resolved);
        return;
      }

      // Try as directory (INDEX.md / README.md)
      const found = findDefaultFile(files, resolved);
      if (found) navigateTo(found);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentPath, files]
  );

  function loadFiles(entries: FileEntry[], label: string) {
    const map = new Map(entries.map((e) => [e.path, e.content]));
    setFiles(map);
    setFileTree(buildFileTree(entries));
    setLoadedLabel(label);
    setSidebarTab("files");

    const first = findDefaultFile(map);
    if (first) setCurrentPath(first);
  }

  function handleLoadFile(entry: FileEntry) {
    loadFiles([entry], entry.path);
  }

  function handleLoadDirectory(entries: FileEntry[]) {
    // Guess root name from first path
    const rootName = entries[0]?.path.split("/")[0] ?? "directory";
    loadFiles(entries, `${rootName}/ (${entries.length} files)`);
  }

  function handleClear() {
    setFiles(new Map([[SAMPLE.path, SAMPLE.content]]));
    setFileTree([]);
    setCurrentPath(SAMPLE.path);
    setLoadedLabel(undefined);
    setSidebarTab("toc");
  }

  function applyEditor() {
    setFiles((prev) => {
      const next = new Map(prev);
      next.set(currentPath, editorValue);
      return next;
    });
    setShowEditor(false);
  }

  const hasDirectory = fileTree.length > 0;

  return (
    <div className="flex flex-col h-screen bg-white dark:bg-gray-900 overflow-hidden">
      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 z-10 shrink-0">
        <span className="text-base font-bold text-blue-600 dark:text-blue-400 shrink-0">
          MD Viewer
        </span>
        <div className="flex-1 min-w-0">
          <MarkdownInput
            loadedInfo={loadedLabel}
            onLoadFile={handleLoadFile}
            onLoadDirectory={handleLoadDirectory}
            onClear={handleClear}
          />
        </div>
        <button
          onClick={() => setShowEditor((v) => !v)}
          className={`px-3 py-1.5 rounded text-xs transition-colors shrink-0 ${
            showEditor
              ? "bg-blue-600 text-white"
              : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
          }`}
        >
          {showEditor ? "プレビュー" : "編集"}
        </button>
      </header>

      {/* Breadcrumb */}
      {currentPath && (
        <div className="px-4 py-1 text-xs text-gray-400 dark:text-gray-500 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 shrink-0 truncate">
          {currentPath}
        </div>
      )}

      {/* Editor */}
      {showEditor && (
        <div className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-3 flex gap-2 shrink-0">
          <textarea
            value={editorValue}
            onChange={(e) => setEditorValue(e.target.value)}
            className="flex-1 h-52 font-mono text-xs p-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 resize-none focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          <div className="flex flex-col gap-2">
            <button
              onClick={applyEditor}
              className="px-3 py-1.5 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 transition-colors"
            >
              適用
            </button>
            <button
              onClick={() => setShowEditor(false)}
              className="px-3 py-1.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded text-xs hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
            >
              キャンセル
            </button>
          </div>
        </div>
      )}

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-60 shrink-0 flex flex-col border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-gray-200 dark:border-gray-700 shrink-0">
            {hasDirectory && (
              <button
                onClick={() => setSidebarTab("files")}
                className={`flex-1 text-xs py-2 transition-colors ${
                  sidebarTab === "files"
                    ? "text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400 font-medium"
                    : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                }`}
              >
                ファイル
              </button>
            )}
            <button
              onClick={() => setSidebarTab("toc")}
              className={`flex-1 text-xs py-2 transition-colors ${
                sidebarTab === "toc"
                  ? "text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400 font-medium"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              }`}
            >
              目次
            </button>
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto p-2">
            {sidebarTab === "files" && hasDirectory ? (
              <FileTree
                nodes={fileTree}
                currentPath={currentPath}
                onSelect={navigateTo}
              />
            ) : (
              <>
                {headings.length > 0 ? (
                  <TableOfContents
                    headings={headings}
                    activeId={activeId}
                    onSelect={scrollToHeading}
                  />
                ) : (
                  <p className="text-xs text-gray-400 px-2">見出しがありません</p>
                )}
              </>
            )}
          </div>
        </aside>

        {/* Markdown content */}
        <main className="flex-1 overflow-y-auto" ref={contentRef}>
          <div
            className="prose prose-slate dark:prose-invert max-w-4xl mx-auto px-8 py-8 prose-a:text-blue-600 prose-a:no-underline hover:prose-a:underline prose-code:before:content-none prose-code:after:content-none"
            dangerouslySetInnerHTML={{ __html: html }}
            onClick={handleContentClick}
          />
        </main>
      </div>
    </div>
  );
}
