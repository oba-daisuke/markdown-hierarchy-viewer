#!/usr/bin/env python3
"""Markdown Hierarchy Viewer – Python/FastAPI edition.

Usage:
    python app.py [directory] [--port 8000] [--host 127.0.0.1]
"""

import argparse
import pathlib
import re
import sys
import urllib.parse
from dataclasses import dataclass, field
from typing import Optional

import markdown as mdlib
import uvicorn
from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pygments.formatters import HtmlFormatter

# ── Data structures ───────────────────────────────────────────────────────────

@dataclass
class FileNode:
    name: str
    path: str       # relative to ROOT_DIR, "/" separators
    is_dir: bool
    children: list["FileNode"] = field(default_factory=list)


@dataclass
class FlatHeading:
    level: int
    text: str
    id: str


@dataclass
class HeadingNode:
    level: int
    text: str
    id: str
    children: list["HeadingNode"] = field(default_factory=list)


# ── Globals ───────────────────────────────────────────────────────────────────

ROOT_DIR: pathlib.Path = pathlib.Path(".").resolve()
BASE_DIR = pathlib.Path(__file__).parent

# ── File system helpers ───────────────────────────────────────────────────────

def safe_path(relative: str) -> pathlib.Path:
    """Resolve path within ROOT_DIR; raise 403 if it escapes."""
    try:
        p = (ROOT_DIR / relative).resolve()
        p.relative_to(ROOT_DIR)   # raises ValueError if outside
    except ValueError:
        raise HTTPException(status_code=403, detail="Access denied")
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return p


def build_file_tree(directory: pathlib.Path) -> list[FileNode]:
    """Scan directory recursively; return only .md files and non-empty dirs."""
    nodes: list[FileNode] = []
    try:
        entries = sorted(
            directory.iterdir(),
            key=lambda e: (not e.is_dir(), e.name.lower()),
        )
    except PermissionError:
        return []

    for entry in entries:
        if entry.name.startswith("."):
            continue
        rel = str(entry.relative_to(ROOT_DIR)).replace("\\", "/")
        if entry.is_dir():
            children = build_file_tree(entry)
            if children:
                nodes.append(FileNode(name=entry.name, path=rel, is_dir=True, children=children))
        elif entry.suffix.lower() == ".md":
            nodes.append(FileNode(name=entry.name, path=rel, is_dir=False))

    return nodes


def find_default_file(directory: pathlib.Path) -> Optional[pathlib.Path]:
    """Return INDEX.md, README.md, or the first .md file in directory."""
    for name in ("INDEX.md", "README.md"):
        p = directory / name
        if p.is_file():
            return p
    try:
        for p in sorted(directory.iterdir(), key=lambda x: x.name):
            if not p.name.startswith(".") and p.is_file() and p.suffix.lower() == ".md":
                return p
    except PermissionError:
        pass
    return None


def read_file(path: pathlib.Path) -> str:
    return path.read_text(encoding="utf-8", errors="replace")


# ── Markdown helpers ──────────────────────────────────────────────────────────

def slugify(text: str) -> str:
    """GitHub-compatible heading slug (ASCII + CJK-friendly)."""
    s = text.lower()
    s = re.sub(r"[^\w\s぀-鿿-]", "", s)
    s = re.sub(r"[\s_]+", "-", s.strip())
    s = re.sub(r"-+", "-", s)
    return s


def extract_flat_headings(content: str) -> list[FlatHeading]:
    """Parse headings from raw markdown with deduplicated GitHub-style IDs."""
    flat: list[FlatHeading] = []
    counts: dict[str, int] = {}
    for m in re.finditer(r"^(#{1,6})\s+(.+?)(?:\s+#+)?\s*$", content, re.MULTILINE):
        level = len(m.group(1))
        raw = m.group(2).strip()
        # Strip common inline markdown
        text = re.sub(r"`[^`]*`", "", raw)
        text = re.sub(r"\[([^\]]*)\]\([^)]*\)", r"\1", text)
        text = re.sub(r"[*_]{1,3}([^*_]+)[*_]{1,3}", r"\1", text).strip()
        base = slugify(text)
        n = counts.get(base, 0)
        counts[base] = n + 1
        slug = base if n == 0 else f"{base}-{n}"
        flat.append(FlatHeading(level=level, text=text, id=slug))
    return flat


def build_heading_tree(flat: list[FlatHeading]) -> list[HeadingNode]:
    root: list[HeadingNode] = []
    stack: list[HeadingNode] = []
    for h in flat:
        node = HeadingNode(level=h.level, text=h.text, id=h.id)
        while stack and stack[-1].level >= h.level:
            stack.pop()
        (stack[-1].children if stack else root).append(node)
        stack.append(node)
    return root


def resolve_path(current: str, href: str) -> str:
    """Resolve href relative to current path (like a browser would)."""
    base = current.rsplit("/", 1)[0] if "/" in current.rstrip("/") else ""
    raw = f"{base}/{href}" if base else href
    out: list[str] = []
    for p in raw.split("/"):
        if p == "..":
            if out:
                out.pop()
        elif p and p != ".":
            out.append(p)
    return "/".join(out)


def render_markdown(content: str, current_path: str = "") -> str:
    """Render markdown to HTML with syntax highlighting and link rewriting."""
    html = mdlib.markdown(
        content,
        extensions=["fenced_code", "tables", "toc", "codehilite", "sane_lists"],
        extension_configs={
            "codehilite": {"css_class": "highlight", "guess_lang": False},
            "toc": {"slugify": lambda text, sep: slugify(text), "toc_depth": "1-6"},
        },
    )

    def rewrite(m: re.Match) -> str:
        href = m.group(1)
        if href.startswith(("http://", "https://", "mailto:", "#", "/")):
            return m.group(0)
        resolved = resolve_path(current_path, href)
        # Append trailing slash for directory links
        if not resolved.endswith(".md") and not resolved.endswith("/") and "." not in pathlib.Path(resolved).name:
            resolved += "/"
        return f'href="/view?path={urllib.parse.quote(resolved)}"'

    return re.sub(r'href="([^"]*)"', rewrite, html)


# ── Tree helpers ──────────────────────────────────────────────────────────────

def find_tree_node(tree: list[FileNode], path: str) -> Optional[FileNode]:
    parts = path.split("/") if path else []
    nodes = tree
    found: Optional[FileNode] = None
    for part in parts:
        found = next((n for n in nodes if n.name == part), None)
        if not found:
            return None
        nodes = found.children
    return found


def get_dir_children(tree: list[FileNode], rel_dir: str) -> list[FileNode]:
    if not rel_dir:
        return tree
    node = find_tree_node(tree, rel_dir)
    return node.children if node else []


def generate_dir_page(dir_abs: pathlib.Path, rel_dir: str, tree: list[FileNode]) -> str:
    name = (dir_abs.name + "/") if rel_dir else "ルート/"
    children = get_dir_children(tree, rel_dir)
    dirs = [n for n in children if n.is_dir]
    files = [n for n in children if not n.is_dir]

    lines = [f"# {name}\n"]
    if dirs:
        lines.append("\n## 📁 サブディレクトリ\n")
        for d in dirs:
            lines.append(f"- [{d.name}/]({d.name}/)\n")
    if files:
        lines.append("\n## 📄 ファイル\n")
        for f in files:
            try:
                txt = read_file(ROOT_DIR / f.path)
                m = re.search(r"^#+\s+(.+)", txt, re.MULTILINE)
                title = m.group(1).strip() if m else f.name
            except OSError:
                title = f.name
            lines.append(f"- [{title}]({f.name})\n")
    return "".join(lines)


def build_subtree_data(children: list[FileNode], current_path: str) -> list[dict]:
    """Pre-compute heading data for subtree panel template rendering."""
    result = []
    for node in children:
        is_on_path = (
            current_path == node.path
            or current_path.startswith(node.path + "/")
            or current_path == node.path + "/"
        )
        if node.is_dir:
            dir_heading: Optional[str] = None
            default = find_default_file(ROOT_DIR / node.path)
            if default:
                try:
                    txt = read_file(default)
                    m = re.search(r"^#+\s+(.+)", txt, re.MULTILINE)
                    dir_heading = m.group(1).strip() if m else None
                except OSError:
                    pass
            result.append({
                "type": "dir",
                "node": node,
                "dir_heading": dir_heading,
                "is_active": is_on_path,
                "children": build_subtree_data(node.children, current_path),
            })
        else:
            is_current = current_path == node.path
            try:
                txt = read_file(ROOT_DIR / node.path)
                flat = extract_flat_headings(txt)
                first_heading = flat[0].text if flat else None
            except OSError:
                flat = []
                first_heading = None
            result.append({
                "type": "file",
                "node": node,
                "headings": flat,
                "first_heading": first_heading,
                "is_current": is_current,
            })
    return result


# ── FastAPI app ───────────────────────────────────────────────────────────────

app = FastAPI(title="Markdown Hierarchy Viewer")
templates = Jinja2Templates(directory=str(BASE_DIR / "templates"))
templates.env.filters["q"] = urllib.parse.quote
app.mount("/static", StaticFiles(directory=str(BASE_DIR / "static")), name="static")


@app.get("/", response_class=HTMLResponse)
async def root_redirect():
    default = find_default_file(ROOT_DIR)
    if default:
        rel = str(default.relative_to(ROOT_DIR)).replace("\\", "/")
        return RedirectResponse(f"/view?path={urllib.parse.quote(rel)}")
    return RedirectResponse("/view?path=")


@app.get("/view", response_class=HTMLResponse)
async def view_page(request: Request, path: str = Query(default="")):
    path = path.replace("\\", "/")
    clean = path.strip("/")

    abs_path = safe_path(clean) if clean else ROOT_DIR
    rel_path = clean

    tree = build_file_tree(ROOT_DIR)

    if abs_path.is_dir():
        default = find_default_file(abs_path)
        if default:
            rel = str(default.relative_to(ROOT_DIR)).replace("\\", "/")
            return RedirectResponse(f"/view?path={urllib.parse.quote(rel)}")
        content = generate_dir_page(abs_path, rel_path, tree)
        current_path = (rel_path + "/") if rel_path else "/"
        is_virtual = True
    elif abs_path.is_file() and abs_path.suffix.lower() == ".md":
        content = read_file(abs_path)
        current_path = rel_path
        is_virtual = False
    else:
        raise HTTPException(status_code=404, detail=f"Not found: {path!r}")

    flat_headings = extract_flat_headings(content)
    heading_tree = build_heading_tree(flat_headings)
    html_content = render_markdown(content, current_path)

    # Parent directory determines subtree context (same as original)
    parent_rel = rel_path.rsplit("/", 1)[0] if "/" in rel_path else ""
    subtree_children = get_dir_children(tree, parent_rel)
    subtree_data = build_subtree_data(subtree_children, current_path)
    parent_label = (parent_rel.split("/")[-1] + "/") if parent_rel else "ルート/"

    # Breadcrumb segments
    if current_path and current_path not in ("/", ""):
        parts = current_path.rstrip("/").split("/")
        is_trail = current_path.endswith("/")
        breadcrumb = [
            {
                "name": p + ("/" if is_trail and i == len(parts) - 1 else ""),
                "path": "/".join(parts[: i + 1]),
                "is_last": i == len(parts) - 1,
            }
            for i, p in enumerate(parts)
        ]
    else:
        breadcrumb = []

    pygments_css = HtmlFormatter(style="default").get_style_defs(".highlight")

    return templates.TemplateResponse(
        request=request,
        name="viewer.html",
        context={
            "tree": tree,
            "current_path": current_path,
            "html_content": html_content,
            "heading_tree": heading_tree,
            "flat_headings": flat_headings,
            "subtree_data": subtree_data,
            "parent_label": parent_label,
            "parent_rel": parent_rel,
            "is_virtual": is_virtual,
            "breadcrumb": breadcrumb,
            "root_name": ROOT_DIR.name,
            "pygments_css": pygments_css,
        },
    )


# ── CLI ───────────────────────────────────────────────────────────────────────

def main() -> None:
    global ROOT_DIR
    parser = argparse.ArgumentParser(description="Markdown Hierarchy Viewer")
    parser.add_argument(
        "directory",
        nargs="?",
        default=".",
        help="Directory to browse (default: current directory)",
    )
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", "-p", type=int, default=8000)
    args = parser.parse_args()

    ROOT_DIR = pathlib.Path(args.directory).resolve()
    if not ROOT_DIR.is_dir():
        print(f"Error: {ROOT_DIR} is not a directory", file=sys.stderr)
        sys.exit(1)

    print(f"Serving: {ROOT_DIR}")
    print(f"Open:    http://{args.host}:{args.port}")
    uvicorn.run(app, host=args.host, port=args.port, log_level="warning")


if __name__ == "__main__":
    main()
