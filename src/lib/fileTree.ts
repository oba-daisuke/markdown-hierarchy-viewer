export interface FileEntry {
  path: string;
  content: string;
}

export interface FileNode {
  name: string;
  path: string;
  isDir: boolean;
  children: FileNode[];
}

export function buildFileTree(files: FileEntry[]): FileNode[] {
  const root: FileNode[] = [];

  for (const file of files) {
    const parts = file.path.split("/").filter(Boolean);
    let nodes = root;
    let cur = "";

    for (let i = 0; i < parts.length; i++) {
      const name = parts[i];
      cur = cur ? `${cur}/${name}` : name;
      const isLast = i === parts.length - 1;

      let node = nodes.find((n) => n.name === name);
      if (!node) {
        node = { name, path: cur, isDir: !isLast, children: [] };
        nodes.push(node);
      }
      if (!isLast) nodes = node.children;
    }
  }

  sortTree(root);
  return root;
}

function sortTree(nodes: FileNode[]) {
  nodes.sort((a, b) => {
    if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
    return a.name.localeCompare(b.name, "ja");
  });
  nodes.forEach((n) => n.children.length && sortTree(n.children));
}

export function resolveRelativePath(
  currentPath: string,
  href: string
): string | null {
  if (href.startsWith("http") || href.startsWith("mailto:")) return null;

  const dir = currentPath.includes("/")
    ? currentPath.slice(0, currentPath.lastIndexOf("/"))
    : "";

  const combined = dir ? `${dir}/${href}` : href;
  const parts = combined.split("/").filter(Boolean);
  const resolved: string[] = [];

  for (const part of parts) {
    if (part === "..") resolved.pop();
    else if (part !== ".") resolved.push(part);
  }

  return resolved.join("/");
}

export function findDefaultFile(
  files: Map<string, string>,
  dirPath?: string
): string | null {
  const prefix = dirPath ? `${dirPath}/` : "";
  for (const candidate of ["INDEX.md", "README.md"]) {
    const p = `${prefix}${candidate}`;
    if (files.has(p)) return p;
  }
  for (const key of files.keys()) {
    if (!dirPath || key.startsWith(prefix)) return key;
  }
  return null;
}

export async function readDirectoryEntries(
  entry: FileSystemDirectoryEntry
): Promise<FileEntry[]> {
  const results: FileEntry[] = [];
  await traverse(entry, results, "");
  return results;
}

async function traverse(
  dir: FileSystemDirectoryEntry,
  results: FileEntry[],
  base: string
) {
  const reader = dir.createReader();
  let batch: FileSystemEntry[];

  do {
    batch = await new Promise<FileSystemEntry[]>((res, rej) =>
      reader.readEntries(res, rej)
    );
    for (const item of batch) {
      if (item.name.startsWith(".")) continue;
      const path = base ? `${base}/${item.name}` : item.name;
      if (item.isFile && item.name.endsWith(".md")) {
        const file = await new Promise<File>((res, rej) =>
          (item as FileSystemFileEntry).file(res, rej)
        );
        results.push({ path, content: await file.text() });
      } else if (item.isDirectory) {
        await traverse(item as FileSystemDirectoryEntry, results, path);
      }
    }
  } while (batch.length > 0);
}
