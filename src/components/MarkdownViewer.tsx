"use client";

import { useEffect, useRef, useState } from "react";
import { renderMarkdown, extractHeadings, HeadingNode } from "@/lib/markdown";
import TableOfContents from "./TableOfContents";
import MarkdownInput from "./MarkdownInput";

const SAMPLE_MARKDOWN = `# はじめに

このビューアは**階層的なMarkdown**を見やすく表示するツールです。

## 特徴

### ツリーナビゲーション

左サイドバーに見出し構造がツリー表示されます。クリックでジャンプできます。

### シンタックスハイライト

\`\`\`typescript
function greet(name: string): string {
  return \`Hello, \${name}!\`;
}
\`\`\`

### GFM対応

- [x] テーブル
- [x] チェックリスト
- [x] 打ち消し線 ~~example~~

## 使い方

1. Markdownファイルをドロップするか、下のエリアに貼り付けてください
2. 見出しがサイドバーにツリー表示されます
3. クリックで該当箇所にジャンプします

# 応用

## カスタムMarkdown

好きなMarkdownを貼り付けて試してみてください。

### ネストした見出し

#### 4レベル目

##### 5レベル目

###### 6レベル目まで対応
`;

export default function MarkdownViewer() {
  const [markdown, setMarkdown] = useState(SAMPLE_MARKDOWN);
  const [html, setHtml] = useState("");
  const [headings, setHeadings] = useState<HeadingNode[]>([]);
  const [activeId, setActiveId] = useState("");
  const [showEditor, setShowEditor] = useState(false);
  const [editorValue, setEditorValue] = useState(SAMPLE_MARKDOWN);
  const contentRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    renderMarkdown(markdown).then(setHtml);
    setHeadings(extractHeadings(markdown));
  }, [markdown]);

  useEffect(() => {
    if (!contentRef.current) return;

    observerRef.current?.disconnect();

    const headingEls = contentRef.current.querySelectorAll(
      "h1[id], h2[id], h3[id], h4[id], h5[id], h6[id]"
    );

    observerRef.current = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length > 0) {
          setActiveId(visible[0].target.id);
        }
      },
      { rootMargin: "-10% 0px -80% 0px" }
    );

    headingEls.forEach((el) => observerRef.current!.observe(el));

    return () => observerRef.current?.disconnect();
  }, [html]);

  function scrollTo(id: string) {
    const el = contentRef.current?.querySelector(`#${id}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      setActiveId(id);
    }
  }

  function applyEditor() {
    setMarkdown(editorValue);
    setShowEditor(false);
  }

  return (
    <div className="flex flex-col h-screen bg-white dark:bg-gray-900">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 z-10">
        <div className="flex items-center gap-3">
          <span className="text-xl font-bold text-blue-600 dark:text-blue-400">
            MD Viewer
          </span>
          <span className="text-xs text-gray-400 hidden sm:inline">
            階層的Markdownビューア
          </span>
        </div>
        <div className="flex items-center gap-2">
          <MarkdownInput value={markdown} onChange={setMarkdown} />
          <button
            onClick={() => {
              setEditorValue(markdown);
              setShowEditor(!showEditor);
            }}
            className={`px-3 py-1.5 rounded text-sm transition-colors ${
              showEditor
                ? "bg-blue-600 text-white"
                : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
            }`}
          >
            {showEditor ? "プレビュー" : "編集"}
          </button>
        </div>
      </header>

      {/* Editor panel */}
      {showEditor && (
        <div className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-4 flex gap-3">
          <textarea
            value={editorValue}
            onChange={(e) => setEditorValue(e.target.value)}
            className="flex-1 h-64 font-mono text-sm p-3 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 resize-none focus:outline-none focus:ring-2 focus:ring-blue-400"
            placeholder="Markdownをここに入力..."
          />
          <div className="flex flex-col gap-2">
            <button
              onClick={applyEditor}
              className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 transition-colors"
            >
              適用
            </button>
            <button
              onClick={() => setShowEditor(false)}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded text-sm hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
            >
              キャンセル
            </button>
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-64 shrink-0 overflow-y-auto border-r border-gray-200 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-800">
          <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
            目次
          </div>
          {headings.length > 0 ? (
            <TableOfContents
              headings={headings}
              activeId={activeId}
              onSelect={scrollTo}
            />
          ) : (
            <p className="text-xs text-gray-400">見出しがありません</p>
          )}
        </aside>

        {/* Markdown content */}
        <main className="flex-1 overflow-y-auto">
          <div
            ref={contentRef}
            className="prose prose-slate dark:prose-invert max-w-4xl mx-auto px-8 py-8"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </main>
      </div>
    </div>
  );
}
