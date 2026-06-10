import type { BookmarkFolderNode } from '../types';

/**
 * Parses a list of flat folder paths (e.g. ['src/app', 'src/pages', 'public'])
 * into a hierarchical tree of folder nodes.
 */
export function buildBookmarkFolderTree(paths: string[]): BookmarkFolderNode[] {
  const roots: BookmarkFolderNode[] = [];

  for (const path of paths) {
    if (!path) continue;
    const parts = path.split('/');
    let currentLevel = roots;
    let currentPath = '';

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      currentPath = currentPath ? `${currentPath}/${part}` : part;

      let node = currentLevel.find((n) => n.name === part);
      if (!node) {
        node = { name: part, path: currentPath, children: [] };
        currentLevel.push(node);
      }
      currentLevel = node.children;
    }
  }

  return roots;
}
