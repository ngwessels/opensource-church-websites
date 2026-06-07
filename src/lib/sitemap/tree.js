/**
 * @param {import('@/types/firestore').NavNodeType[]} nodes - flat nav nodes
 */
export function buildNavTree(nodes) {
  const sorted = [...nodes].sort((a, b) => a.order - b.order);
  const map = new Map();
  const roots = [];

  for (const node of sorted) {
    map.set(node.id, { ...node, children: [] });
  }

  for (const node of sorted) {
    const item = map.get(node.id);
    if (node.parentId && map.has(node.parentId)) {
      map.get(node.parentId).children.push(item);
    } else {
      roots.push(item);
    }
  }

  return roots;
}

export function flattenNavTree(tree, parentId = null) {
  const result = [];
  tree.forEach((node, index) => {
    const { children, ...rest } = node;
    result.push({
      ...rest,
      parentId,
      order: index,
      children: undefined,
    });
    if (children?.length) {
      result.push(...flattenNavTree(children, node.id));
    }
  });
  return result;
}

export function countPages(nodes) {
  return nodes.filter(
    (n) =>
      n.type === "page" ||
      n.type === "secure_page" ||
      (n.type === "group" && n.pageId),
  ).length;
}

export function generateId() {
  return `nav_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function generatePageId() {
  return `page_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function slugify(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80) || "page";
}

/** @param {object[]} nodes */
export function getSiblings(nodes, parentId) {
  return nodes
    .filter((n) => (n.parentId ?? null) === parentId)
    .sort((a, b) => a.order - b.order);
}

/** @param {object[]} nodes */
export function getNodeDepth(nodes, nodeId) {
  let depth = 0;
  let current = nodes.find((n) => n.id === nodeId);
  while (current?.parentId) {
    depth += 1;
    current = nodes.find((n) => n.id === current.parentId);
  }
  return depth;
}

/** Depth if node were placed under targetParentId (0 = root column). */
export function getDepthUnderParent(nodes, targetParentId) {
  if (!targetParentId) return 0;
  return getNodeDepth(nodes, targetParentId) + 1;
}

/** @param {object[]} nodes */
export function isDescendant(nodes, ancestorId, nodeId) {
  let current = nodes.find((n) => n.id === nodeId);
  while (current?.parentId) {
    if (current.parentId === ancestorId) return true;
    current = nodes.find((n) => n.id === current.parentId);
  }
  return false;
}

/**
 * @param {object[]} nodes
 * @param {string|null} activeId - null when creating from palette
 */
export function canDropAt(nodes, activeId, targetParentId, maxLevel) {
  const depth = getDepthUnderParent(nodes, targetParentId);
  if (depth >= maxLevel) return false;
  if (activeId && targetParentId) {
    if (activeId === targetParentId) return false;
    if (isDescendant(nodes, activeId, targetParentId)) return false;
  }
  return true;
}

/** Reassign order indices for all siblings under each parent. */
function normalizeOrders(nodes) {
  const parentIds = new Set(nodes.map((n) => n.parentId ?? null));
  let result = [...nodes];
  for (const parentId of parentIds) {
    const siblings = getSiblings(result, parentId);
    siblings.forEach((sibling, index) => {
      result = result.map((n) => (n.id === sibling.id ? { ...n, order: index } : n));
    });
  }
  return result;
}

/**
 * @param {object[]} nodes
 * @param {string} activeId
 * @param {string} overId
 * @param {'before' | 'after'} position
 */
export function moveNode(nodes, activeId, overId, position) {
  const active = nodes.find((n) => n.id === activeId);
  const over = nodes.find((n) => n.id === overId);
  if (!active || !over || activeId === overId) return nodes;

  const parentId = over.parentId ?? null;
  const siblings = getSiblings(nodes, parentId).filter((n) => n.id !== activeId);
  let insertIndex = siblings.findIndex((n) => n.id === overId);
  if (insertIndex === -1) return nodes;
  if (position === "after") insertIndex += 1;

  const updated = nodes.map((n) =>
    n.id === activeId ? { ...n, parentId, isQuickLink: false } : n,
  );
  const reordered = [...siblings];
  reordered.splice(insertIndex, 0, { ...active, parentId, isQuickLink: false });

  let result = updated.map((n) => {
    const idx = reordered.findIndex((s) => s.id === n.id);
    if (idx !== -1) return { ...n, order: idx, parentId };
    return n;
  });
  return normalizeOrders(result);
}

/**
 * @param {object[]} nodes
 * @param {string} activeId
 * @param {string|null} newParentId
 * @param {number} index
 */
export function reparentNode(nodes, activeId, newParentId, index) {
  const active = nodes.find((n) => n.id === activeId);
  if (!active) return nodes;

  const siblings = getSiblings(nodes, newParentId).filter((n) => n.id !== activeId);
  const clampedIndex = Math.max(0, Math.min(index, siblings.length));

  const updated = nodes.map((n) =>
    n.id === activeId
      ? { ...n, parentId: newParentId, isQuickLink: false, order: clampedIndex }
      : n,
  );
  return normalizeOrders(updated);
}

/** @param {object[]} nodes */
export function sortQuickLinks(nodes) {
  return nodes
    .filter((n) => n.isQuickLink)
    .sort((a, b) => {
      const ao = a.quickLinkOrder ?? a.order ?? 0;
      const bo = b.quickLinkOrder ?? b.order ?? 0;
      return ao - bo;
    });
}

/** Next quickLinkOrder for a newly promoted quick link. */
export function nextQuickLinkOrder(nodes) {
  const links = sortQuickLinks(nodes);
  if (links.length === 0) return 0;
  return Math.max(...links.map((n) => n.quickLinkOrder ?? n.order ?? 0)) + 1;
}

/**
 * @param {object[]} nodes
 * @param {string} activeId
 * @param {number} newIndex
 */
export function reorderQuickLinks(nodes, activeId, newIndex) {
  const links = sortQuickLinks(nodes);
  const oldIndex = links.findIndex((n) => n.id === activeId);
  if (oldIndex === -1 || oldIndex === newIndex) return nodes;

  const reordered = [...links];
  const [moved] = reordered.splice(oldIndex, 1);
  reordered.splice(newIndex, 0, moved);

  return nodes.map((n) => {
    const idx = reordered.findIndex((l) => l.id === n.id);
    if (idx === -1) return n;
    return { ...n, quickLinkOrder: idx, isQuickLink: true };
  });
}

/** Promote a node to quick links. */
export function addToQuickLinks(nodes, nodeId) {
  const order = nextQuickLinkOrder(nodes);
  return nodes.map((n) =>
    n.id === nodeId ? { ...n, isQuickLink: true, quickLinkOrder: order } : n,
  );
}

/** Remove quick-link flag from a node. */
export function removeFromQuickLinks(nodes, nodeId) {
  return nodes.map((n) =>
    n.id === nodeId ? { ...n, isQuickLink: false, quickLinkOrder: undefined } : n,
  );
}

/** @param {import('@/types/firestore').NavNode} node */
export function isRootColumnNode(node) {
  return (node.parentId ?? null) === null;
}

/** @param {import('@/types/firestore').NavNode} node */
export function isHomeNode(node) {
  return (
    isRootColumnNode(node) &&
    node.type === "page" &&
    (node.slug === "" || node.slug === undefined)
  );
}

/**
 * Whether a template type can be created at the given parent.
 * Root allows only link groups (Home is the sole root page, created at bootstrap).
 * @param {import('@/types/firestore').NavNodeType} type
 */
export function canCreateTypeAtParent(type, parentId) {
  if (parentId === null) {
    return type === "group";
  }
  return true;
}

/** @param {object[]} nodes @param {string} nodeId */
export function getAncestorChain(nodes, nodeId) {
  const chain = [];
  let current = nodes.find((n) => n.id === nodeId);
  while (current) {
    chain.unshift(current);
    current = current.parentId ? nodes.find((n) => n.id === current.parentId) : null;
  }
  return chain;
}

/** Full URL path (no leading slash) from ancestor local slug segments. */
export function getFullSlug(nodes, nodeId) {
  const chain = getAncestorChain(nodes, nodeId);
  const segments = chain
    .map((n) => n.slug)
    .filter((s) => s !== undefined && s !== null && s !== "");
  return segments.join("/");
}

/** @param {object[]} nodes @param {import('@/types/firestore').NavNode} node */
export function resolveNavHref(nodes, node) {
  if (node.type === "link") {
    return node.externalUrl || "#";
  }
  if (node.type === "group" && !node.pageId) {
    return "#";
  }
  const full = getFullSlug(nodes, node.id);
  if (full === "") return "/";
  return `/${full}`;
}

/**
 * Find the nav node linked to a page doc.
 * @param {object[]} nodes
 * @param {{ slug?: string, pageId?: string }} page
 */
export function findNavNodeForPage(nodes, page) {
  if (!page || !nodes?.length) return null;

  if (page.pageId) {
    const byId = nodes.find((n) => n.pageId === page.pageId);
    if (byId) return byId;
  }

  const slug = page.slug ?? "";
  return (
    nodes.find((n) => {
      if (n.type === "link") return false;
      if (!n.pageId && n.type !== "group") return false;
      return getFullSlug(nodes, n.id) === slug;
    }) ?? null
  );
}

/**
 * Section sidebar context for pages inside a root link group.
 * @param {object[]} nodes
 * @param {{ slug?: string, pageId?: string }} page
 * @returns {{ sectionRoot: object, items: object[], activeNodeId: string } | null}
 */
export function getSectionNavContext(nodes, page) {
  const navNode = findNavNodeForPage(nodes, page);
  if (!navNode) return null;

  const chain = getAncestorChain(nodes, navNode.id);
  const sectionRoot = chain[0];
  if (!sectionRoot || sectionRoot.type !== "group" || sectionRoot.hideInNav) {
    return null;
  }

  const items = [];
  if (sectionRoot.pageId) {
    items.push(sectionRoot);
  }
  items.push(...getSiblings(nodes, sectionRoot.id));

  return {
    sectionRoot,
    items,
    activeNodeId: navNode.id,
  };
}

/**
 * Unique local slug among siblings.
 * @param {object[]} nodes
 * @param {string|null} parentId
 * @param {string} baseSlug
 * @param {string} [excludeId]
 */
export function ensureUniqueLocalSlug(nodes, parentId, baseSlug, excludeId) {
  const siblings = getSiblings(nodes, parentId).filter((n) => n.id !== excludeId);
  const used = new Set(siblings.map((n) => n.slug).filter(Boolean));
  let candidate = baseSlug || "page";
  let i = 2;
  while (used.has(candidate)) {
    candidate = `${baseSlug}-${i}`;
    i += 1;
  }
  return candidate;
}

/** Local slug for a new node from its title. Home uses empty string. */
export function localSlugForNewNode(type, title, parentId, nodes) {
  if (type === "link") return undefined;
  if (type === "page" && parentId === null) return "";
  const base = slugify(title);
  return ensureUniqueLocalSlug(nodes, parentId, base);
}

/**
 * Recompute Firestore page slugs from tree position.
 * Nav nodes keep local `slug` segments; pages collection gets full paths.
 * @param {object[]} nodes
 * @returns {{ nodes: object[], pageUpdates: Map<string, { slug: string, title: string }> }}
 */
const QUICK_LINKS_GROUP_SLUG = "_quick-links";

/** Whether href should open in a new tab. */
export function isExternalHref(href) {
  return /^https?:\/\//i.test(href || "");
}

export const FOOTER_QUICK_LINKS_SOURCE = "quickLinks";

/** @param {{ title?: string, source?: string } | null | undefined} column */
export function isSyncedQuickLinksColumn(column) {
  if (!column) return false;
  if (column.source === FOOTER_QUICK_LINKS_SOURCE) return true;
  return (column.title || "").trim().toLowerCase() === "quick links";
}

/**
 * @param {object[]} quickLinks
 * @param {object[]} navNodes
 */
export function quickLinksToFooterLinks(quickLinks, navNodes) {
  return (quickLinks || []).map((link) => ({
    label: link.title || "",
    href: resolveNavHref(navNodes, link),
  }));
}

/**
 * Replace synced quick-link footer columns with live sitemap quick links.
 * @param {object[]} columns
 * @param {object[]} quickLinks
 * @param {object[]} navNodes
 */
export function resolveFooterColumns(columns, quickLinks, navNodes) {
  return (columns || []).flatMap((col) => {
    if (!isSyncedQuickLinksColumn(col)) return [col];
    const links = quickLinksToFooterLinks(quickLinks, navNodes);
    if (!links.length) return [];
    return [{ ...col, links }];
  });
}

/** Hide groups reserved for header-only external quick links. */
export function filterNavTreeForDisplay(tree) {
  return tree
    .filter((node) => !node.hideInNav)
    .map((node) => ({
      ...node,
      children: node.children?.length ? filterNavTreeForDisplay(node.children) : [],
    }));
}

/** @param {object[]} nodes */
export function getOrCreateQuickLinksGroup(nodes) {
  const existing = nodes.find(
    (n) => n.type === "group" && n.slug === QUICK_LINKS_GROUP_SLUG,
  );
  if (existing) return { nodes, groupId: existing.id };

  const rootSiblings = getSiblings(nodes, null);
  const id = generateId();
  const newGroup = {
    id,
    type: "group",
    title: "Quick Links",
    slug: QUICK_LINKS_GROUP_SLUG,
    parentId: null,
    order: rootSiblings.length,
    hideInNav: true,
    isQuickLink: false,
  };
  return { nodes: [...nodes, newGroup], groupId: id };
}

/** Convert quick-link nav nodes into editor draft rows. */
export function quickLinksToDraftItems(nodes) {
  return sortQuickLinks(nodes).map((link) => {
    if (link.type === "link") {
      return {
        id: link.id,
        title: link.title,
        source: "external",
        externalUrl: link.externalUrl || "",
      };
    }
    return {
      id: link.id,
      title: link.title,
      source: "site",
      targetNodeId: link.id,
    };
  });
}

/**
 * Apply header quick-link editor rows onto the flat nav node list.
 * @param {object[]} nodes
 * @param {Array<{ id: string, title: string, source: 'site' | 'external', targetNodeId?: string, externalUrl?: string }>} items
 */
export function applyQuickLinksDraft(nodes, items) {
  let updated = nodes.map((n) => ({
    ...n,
    isQuickLink: false,
    quickLinkOrder: undefined,
  }));

  items.forEach((item, index) => {
    const title = item.title?.trim();
    if (item.source === "site" && item.targetNodeId) {
      updated = updated.map((n) =>
        n.id === item.targetNodeId
          ? {
              ...n,
              isQuickLink: true,
              quickLinkOrder: index,
              ...(title ? { title } : {}),
            }
          : n,
      );
      return;
    }

    if (item.source !== "external") return;

    const url = (item.externalUrl || "").trim();
    if (!url || !title) return;

    const existing =
      item.id && !String(item.id).startsWith("new_")
        ? updated.find((n) => n.id === item.id)
        : null;

    if (existing?.type === "link") {
      updated = updated.map((n) =>
        n.id === existing.id
          ? { ...n, title, externalUrl: url, isQuickLink: true, quickLinkOrder: index }
          : n,
      );
      return;
    }

    const { nodes: withGroup, groupId } = getOrCreateQuickLinksGroup(updated);
    updated = withGroup;
    const siblings = getSiblings(updated, groupId);
    updated = [
      ...updated,
      {
        id: String(item.id).startsWith("new_") ? generateId() : item.id,
        type: "link",
        title,
        externalUrl: url,
        parentId: groupId,
        order: siblings.length,
        isQuickLink: true,
        quickLinkOrder: index,
      },
    ];
  });

  return updated;
}

export function syncPageSlugs(nodes) {
  const pageUpdates = new Map();

  for (const node of nodes) {
    const hasPage =
      (node.type === "page" || node.type === "secure_page" || node.type === "group") &&
      node.pageId;
    if (!hasPage) continue;

    const fullSlug = getFullSlug(nodes, node.id);
    pageUpdates.set(node.pageId, { slug: fullSlug, title: node.title });
  }

  return { nodes, pageUpdates };
}

