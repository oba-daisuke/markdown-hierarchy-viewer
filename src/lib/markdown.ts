import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeHighlight from "rehype-highlight";
import rehypeStringify from "rehype-stringify";
import rehypeSlug from "rehype-slug";
import { visit } from "unist-util-visit";
import GithubSlugger from "github-slugger";
import type { Root } from "mdast";

export interface FlatHeading {
  level: number;
  text: string;
  id: string;
}

export interface HeadingNode extends FlatHeading {
  children: HeadingNode[];
}

export function extractFlatHeadings(markdown: string): FlatHeading[] {
  const tree = unified().use(remarkParse).use(remarkGfm).parse(markdown) as Root;
  const slugger = new GithubSlugger();
  const flat: FlatHeading[] = [];

  visit(tree, "heading", (node) => {
    const text = node.children
      .map((child) => ("value" in child ? child.value : ""))
      .join("");
    flat.push({ level: node.depth, text, id: slugger.slug(text) });
  });

  return flat;
}

export function extractHeadings(markdown: string): HeadingNode[] {
  return buildTree(extractFlatHeadings(markdown));
}

function buildTree(
  flat: { level: number; text: string; id: string }[]
): HeadingNode[] {
  const root: HeadingNode[] = [];
  const stack: HeadingNode[] = [];

  for (const item of flat) {
    const node: HeadingNode = { ...item, children: [] };

    while (stack.length > 0 && stack[stack.length - 1].level >= item.level) {
      stack.pop();
    }

    if (stack.length === 0) {
      root.push(node);
    } else {
      stack[stack.length - 1].children.push(node);
    }

    stack.push(node);
  }

  return root;
}

export async function renderMarkdown(markdown: string): Promise<string> {
  const result = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeHighlight)
    .use(rehypeSlug)
    .use(rehypeStringify)
    .process(markdown);

  return String(result);
}
