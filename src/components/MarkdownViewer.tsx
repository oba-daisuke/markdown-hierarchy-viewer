"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { renderMarkdown, extractHeadings, HeadingNode } from "@/lib/markdown";
import {
  FileEntry,
  FileNode,
  buildFileTree,
  resolveRelativePath,
  findDefaultFile,
  generateDirPage,
} from "@/lib/fileTree";
import TableOfContents from "./TableOfContents";
import FileTree from "./FileTree";
import MarkdownInput from "./MarkdownInput";
import SubTree from "./SubTree";

const SAMPLE: FileEntry = {
  path: "sample.md",
  content: `# プロジェクト管理システム

> 最終更新: 2026-06-06

## 概要

このビューアは階層的な Markdown ディレクトリをブラウザで閲覧するツールです。
左上の **フォルダ** ボタンでフォルダを読み込んでください。

## 使い方

1. 「フォルダ」ボタンから Markdown ディレクトリを選択
2. 左サイドバーのファイルツリーをクリックしてページ遷移
3. ディレクトリ名をクリックすると INDEX / README に移動

## 進行中プロジェクト

| プロジェクト | 状態 | 担当 | 期限 |
|------------|------|------|------|
| ECサイトリニューアル | 🟡 進行中 | 開発チーム | 2026-07-31 |
| 社内BI基盤構築 | 🟢 順調 | データチーム | 2026-09-30 |
| モバイルアプリv2 | 🔴 遅延リスク | 全体 | 2026-06-30 |

## 今週のフォーカス

- [ ] Q3 ロードマップ最終確認
- [x] チームスプリント計画
`,
};

type SidebarTab = "files" | "toc";

export default function MarkdownViewer() {
  const [files, setFiles] = useState<Map<string, string>>(
    new Map([[SAMPLE.path, SAMPLE.content]])
  );
  const [fileTree, setFileTree] = useState<FileNode[]>([]);
  // currentPath can be a file path ("a/b.md") or a virtual dir path ("a/b/")
  const [currentPath, setCurrentPath] = useState(SAMPLE.path);
  // Content to render: either from files map (file) or generated (virtual dir page)
  const [currentContent, setCurrentContent] = useState(SAMPLE.content);
  const [html, setHtml] = useState("");
  const [headings, setHeadings] = useState<HeadingNode[]>([]);
  const [activeId, setActiveId] = useState("");
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>("toc");
  const [showEditor, setShowEditor] = useState(false);
  const [editorValue, setEditorValue] = useState(SAMPLE.content);
  const [loadedLabel, setLoadedLabel] = useState<string | undefined>();

  const [pendingAnchor, setPendingAnchor] = useState<string | null>(null);

  const contentRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // filesRef / fileTreeRef: for use inside callbacks without stale closures
  const filesRef = useRef(files);
  const fileTreeRef = useRef(fileTree);
  useEffect(() => { filesRef.current = files; }, [files]);
  useEffect(() => { fileTreeRef.current = fileTree; }, [fileTree]);

  // Render whenever content changes
  useEffect(() => {
    renderMarkdown(currentContent).then(setHtml);
    setHeadings(extractHeadings(currentContent));
    setActiveId("");
    contentRef.current?.scrollTo({ top: 0 });
  }, [currentContent]);

  // Scroll to pending anchor after HTML is injected into DOM
  useEffect(() => {
    if (!pendingAnchor) return;
    const id = pendingAnchor;
    setPendingAnchor(null);
    // rAF ensures the DOM has been updated with the new html
    requestAnimationFrame(() => {
      const el = contentRef.current?.querySelector(`#${CSS.escape(id)}`);
      el?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [html, pendingAnchor]);

  // Keep editor in sync with current file (not virtual pages)
  useEffect(() => {
    if (!currentPath.endsWith("/")) {
      setEditorValue(currentContent);
    }
  }, [currentPath, currentContent]);

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

  // Navigate to a file and scroll to a specific heading anchor
  const navigateToAnchor = useCallback((path: string, anchorId: string) => {
    const f = filesRef.current;
    const isSamePage = path === (currentPath.endsWith("/") ? "" : currentPath);
    if (isSamePage) {
      // Already on the file — just scroll
      const el = contentRef.current?.querySelector(`#${CSS.escape(anchorId)}`);
      el?.scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
      // Navigate first, scroll after render
      setPendingAnchor(anchorId);
      if (f.has(path)) {
        setCurrentPath(path);
        setCurrentContent(f.get(path)!);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPath]);

  // Core navigation: accepts file path, directory path, or dir path with trailing "/"
  const navigateTo = useCallback((path: string) => {
    const f = filesRef.current;
    const t = fileTreeRef.current;

    // Normalise: strip trailing slash for lookup
    const cleanPath = path.endsWith("/") ? path.slice(0, -1) : path;

    // 1. Exact file match
    if (f.has(cleanPath)) {
      setCurrentPath(cleanPath);
      setCurrentContent(f.get(cleanPath)!);
      return;
    }

    // 2. Try as directory → look for README / INDEX
    const defaultFile = findDefaultFile(f, cleanPath || undefined);
    if (defaultFile) {
      setCurrentPath(defaultFile);
      setCurrentContent(f.get(defaultFile)!);
      return;
    }

    // 3. No README/INDEX → generate virtual directory listing
    const virtualPath = cleanPath ? cleanPath + "/" : "/";
    const content = generateDirPage(cleanPath, f, t);
    setCurrentPath(virtualPath);
    setCurrentContent(content);
  }, []);

  // Intercept link clicks inside rendered markdown
  const handleContentClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const anchor = (e.target as HTMLElement).closest("a");
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (!href) return;

      if (href.startsWith("http") || href.startsWith("mailto:")) return;

      e.preventDefault();

      if (href.startsWith("#")) {
        const el = contentRef.current?.querySelector(href);
        el?.scrollIntoView({ behavior: "smooth" });
        return;
      }

      const resolved = resolveRelativePath(currentPath, href);
      if (resolved !== null) navigateTo(resolved);
    },
    [currentPath, navigateTo]
  );

  function loadFiles(entries: FileEntry[], label: string) {
    const map = new Map(entries.map((e) => [e.path, e.content]));
    const tree = buildFileTree(entries);
    setFiles(map);
    setFileTree(tree);
    setLoadedLabel(label);
    setSidebarTab("files");

    const first = findDefaultFile(map);
    if (first) {
      setCurrentPath(first);
      setCurrentContent(map.get(first)!);
    }
  }

  function handleClear() {
    setFiles(new Map([[SAMPLE.path, SAMPLE.content]]));
    setFileTree([]);
    setCurrentPath(SAMPLE.path);
    setCurrentContent(SAMPLE.content);
    setLoadedLabel(undefined);
    setSidebarTab("toc");
  }

  function applyEditor() {
    const updated = new Map(files);
    updated.set(currentPath, editorValue);
    setFiles(updated);
    setCurrentContent(editorValue);
    setShowEditor(false);
  }

  const hasDirectory = fileTree.length > 0;
  const isVirtualPage = currentPath.endsWith("/");

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
            onLoadFile={(entry) => loadFiles([entry], entry.path)}
            onLoadDirectory={(entries) => {
              const root = entries[0]?.path.split("/")[0] ?? "directory";
              loadFiles(entries, `${root}/ (${entries.length} files)`);
            }}
            onClear={handleClear}
          />
        </div>
        {!isVirtualPage && (
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
        )}
      </header>

      {/* Breadcrumb */}
      <Breadcrumb path={currentPath} onNavigate={navigateTo} />

      {/* Editor */}
      {showEditor && !isVirtualPage && (
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

          <div className="flex-1 overflow-y-auto p-2">
            {sidebarTab === "files" && hasDirectory ? (
              <FileTree
                nodes={fileTree}
                currentPath={currentPath}
                onSelect={navigateTo}
              />
            ) : headings.length > 0 ? (
              <TableOfContents
                headings={headings}
                activeId={activeId}
                onSelect={scrollToHeading}
              />
            ) : (
              <p className="text-xs text-gray-400 px-2">見出しがありません</p>
            )}
          </div>
        </aside>

        {/* Content */}
        <main className="flex-1 overflow-y-auto" ref={contentRef}>
          <div className="max-w-4xl mx-auto px-8 py-8">
            <div
              className="prose prose-slate dark:prose-invert prose-a:text-blue-600 prose-a:no-underline hover:prose-a:underline prose-code:before:content-none prose-code:after:content-none"
              dangerouslySetInnerHTML={{ __html: html }}
              onClick={handleContentClick}
            />
            {hasDirectory && (
              <SubTree
                currentPath={currentPath}
                fileTree={fileTree}
                files={files}
                onNavigate={navigateTo}
                onNavigateToAnchor={navigateToAnchor}
              />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

// ── Breadcrumb ──────────────────────────────────────────────────────────────

function Breadcrumb({
  path,
  onNavigate,
}: {
  path: string;
  onNavigate: (path: string) => void;
}) {
  if (!path || path === "/") return null;

  // Split path into clickable segments
  // e.g. "projects/ec-renewal/spec.md" → ["projects", "ec-renewal", "spec.md"]
  // e.g. "projects/ec-renewal/"         → ["projects", "ec-renewal/"]
  const isVirtual = path.endsWith("/");
  const cleanPath = isVirtual ? path.slice(0, -1) : path;
  const parts = cleanPath.split("/").filter(Boolean);

  return (
    <nav className="flex items-center gap-0.5 px-4 py-1.5 text-xs border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 shrink-0 overflow-x-auto whitespace-nowrap">
      <button
        onClick={() => onNavigate("")}
        className="text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-200 transition-colors"
      >
        ルート
      </button>
      {parts.map((part, i) => {
        const isLast = i === parts.length - 1;
        const segPath = parts.slice(0, i + 1).join("/");

        return (
          <span key={segPath} className="flex items-center gap-0.5">
            <span className="text-gray-300 dark:text-gray-600 px-0.5">/</span>
            {isLast ? (
              <span className="text-gray-700 dark:text-gray-300 font-medium">
                {part}{isVirtual ? "/" : ""}
              </span>
            ) : (
              <button
                onClick={() => onNavigate(segPath)}
                className="text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-200 transition-colors"
              >
                {part}
              </button>
            )}
          </span>
        );
      })}
    </nav>
  );
}
