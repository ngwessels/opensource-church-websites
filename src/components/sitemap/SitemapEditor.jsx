"use client";

import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  pointerWithin,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { doc, getDoc, updateDoc, writeBatch } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { PageSettingsSheet } from "@/components/builder/PageSettingsSheet";
import { getPageType } from "@/lib/bulletins/schema";

import { getFirebaseFirestore } from "@/lib/firebase/firestore";
import { COLLECTIONS } from "@/lib/firestore/paths";
import { serializeNavNode } from "@/lib/firestore/serialize";
import {
  addToQuickLinks,
  buildNavTree,
  canCreateTypeAtParent,
  canDropAt,
  countPages,
  ensureUniqueLocalSlug,
  flattenNavTree,
  generateId,
  generatePageId,
  getSiblings,
  isHomeNode,
  localSlugForNewNode,
  moveNode,
  removeFromQuickLinks,
  reorderQuickLinks,
  reparentNode,
  resolveNavHref,
  slugify,
  sortQuickLinks,
  syncPageSlugs,
} from "@/lib/sitemap/tree";

import { NavColumn } from "./NavColumn";
import { NavTemplateTile, NAV_TEMPLATE_LABELS, NAV_TEMPLATE_STYLES } from "./NavTemplateTile";
import { QuickLinksBar, parseQuickLinkDragId } from "./QuickLinksBar";

const TEMPLATE_TYPES = ["page", "secure_page", "link", "group"];

function createNode(type, parentId, nodes) {
  if (!canCreateTypeAtParent(type, parentId)) {
    return null;
  }

  const title =
    type === "page"
      ? "New Page"
      : type === "link"
        ? "New Link"
        : type === "group"
          ? "New Group"
          : "Secure Page";

  const id = generateId();
  const siblings = getSiblings(nodes, parentId);
  const hasPage = type === "page" || type === "secure_page" || type === "group";

  return {
    id,
    type,
    title,
    slug: localSlugForNewNode(type, title, parentId, nodes),
    externalUrl: type === "link" ? "https://" : undefined,
    parentId,
    order: siblings.length,
    isQuickLink: false,
    pageId: hasPage ? generatePageId() : undefined,
  };
}

function resolveDropParent(nodes, overData, overId) {
  if (overData?.type === "column") {
    return { parentId: overData.columnId, index: getSiblings(nodes, overData.columnId).length };
  }
  if (overData?.type === "drop-into") {
    const siblings = getSiblings(nodes, overData.nodeId);
    return { parentId: overData.nodeId, index: siblings.length };
  }
  if (overData?.type === "drop-before") {
    const overNode = nodes.find((n) => n.id === overData.nodeId);
    if (!overNode) return null;
    const parentId = overNode.parentId ?? null;
    const siblings = getSiblings(nodes, parentId);
    const index = siblings.findIndex((n) => n.id === overData.nodeId);
    return { parentId, index: Math.max(0, index) };
  }
  if (overData?.type === "drop-after") {
    const overNode = nodes.find((n) => n.id === overData.nodeId);
    if (!overNode) return null;
    const parentId = overNode.parentId ?? null;
    const siblings = getSiblings(nodes, parentId);
    const index = siblings.findIndex((n) => n.id === overData.nodeId);
    return { parentId, index: index + 1 };
  }
  if (overData?.type === "nav-node") {
    const overNode = overData.node;
    const parentId = overNode.parentId ?? null;
    const siblings = getSiblings(nodes, parentId);
    const index = siblings.findIndex((n) => n.id === overNode.id);
    return { parentId, index: index + 1 };
  }
  const overNode = nodes.find((n) => n.id === overId);
  if (overNode) {
    const parentId = overNode.parentId ?? null;
    const siblings = getSiblings(nodes, parentId);
    const index = siblings.findIndex((n) => n.id === overNode.id);
    return { parentId, index: index + 1 };
  }
  return null;
}

export function SitemapEditor({ initialNodes }) {
  const router = useRouter();
  const [nodes, setNodes] = useState(initialNodes);
  const [maxLevel, setMaxLevel] = useState(4);
  const [saving, setSaving] = useState(false);
  const [activeDrag, setActiveDrag] = useState(null);
  const [dropError, setDropError] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [pageTypeMap, setPageTypeMap] = useState({});
  const [settingsPage, setSettingsPage] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const tree = useMemo(() => buildNavTree(nodes), [nodes]);
  const quickLinks = useMemo(() => sortQuickLinks(nodes), [nodes]);
  const pageCount = countPages(nodes);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
  );

  const showError = useCallback((message) => {
    setDropError(message);
    setTimeout(() => setDropError(null), 4000);
  }, []);

  const handleRename = useCallback((id, title) => {
    setNodes((prev) =>
      prev.map((n) => {
        if (n.id !== id) return n;
        const updated = { ...n, title };
        if (n.type === "page" || n.type === "secure_page" || n.type === "group") {
          updated.slug = isHomeNode(n)
            ? ""
            : ensureUniqueLocalSlug(prev, n.parentId ?? null, slugify(title), id);
        }
        return updated;
      }),
    );
  }, []);

  const handleDelete = useCallback((id) => {
    setNodes((prev) => {
      const toRemove = new Set([id]);
      let changed = true;
      while (changed) {
        changed = false;
        for (const n of prev) {
          if (n.parentId && toRemove.has(n.parentId) && !toRemove.has(n.id)) {
            toRemove.add(n.id);
            changed = true;
          }
        }
      }
      return prev.filter((n) => !toRemove.has(n.id));
    });
  }, []);

  const handleView = useCallback(
    (node) => {
      const href = resolveNavHref(nodes, node);
      router.push(`/builder/edit${href === "/" ? "" : href}`);
    },
    [nodes, router],
  );

  const pageIds = useMemo(
    () => [...new Set(nodes.filter((n) => n.pageId).map((n) => n.pageId))],
    [nodes],
  );

  useEffect(() => {
    const db = getFirebaseFirestore();
    if (!db || pageIds.length === 0) {
      setPageTypeMap({});
      return;
    }

    let cancelled = false;

    (async () => {
      const entries = await Promise.all(
        pageIds.map(async (pageId) => {
          const snap = await getDoc(doc(db, COLLECTIONS.pages, pageId));
          const type = snap.exists() ? getPageType(snap.data()) : "content";
          return [pageId, type];
        }),
      );
      if (!cancelled) {
        setPageTypeMap(Object.fromEntries(entries));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [pageIds]);

  const handleSettings = useCallback(async (node) => {
    if (!node.pageId) return;
    const db = getFirebaseFirestore();
    const snap = await getDoc(doc(db, COLLECTIONS.pages, node.pageId));
    if (!snap.exists()) return;
    setSettingsPage({ id: snap.id, ...snap.data() });
    setSettingsOpen(true);
  }, []);

  const handlePageSettingsSave = useCallback(
    async (updates) => {
      if (!settingsPage?.id) return;
      const db = getFirebaseFirestore();
      const now = new Date().toISOString();
      await updateDoc(doc(db, COLLECTIONS.pages, settingsPage.id), {
        ...updates,
        updatedAt: now,
      });
      setSettingsPage((prev) => (prev ? { ...prev, ...updates, updatedAt: now } : prev));
      setPageTypeMap((prev) => ({
        ...prev,
        [settingsPage.id]: updates.pageType || getPageType(settingsPage),
      }));
    },
    [settingsPage],
  );

  const addTemplate = useCallback(
    (type, parentId = null) => {
      if (!canCreateTypeAtParent(type, parentId)) {
        showError("Add pages inside a link group.");
        return;
      }
      setNodes((prev) => {
        if (!canDropAt(prev, null, parentId, maxLevel)) {
          showError("Maximum navigation depth reached.");
          return prev;
        }
        const newNode = createNode(type, parentId, prev);
        if (!newNode) {
          showError("Add pages inside a link group.");
          return prev;
        }
        return [...prev, newNode];
      });
    },
    [maxLevel, showError],
  );

  const handleDragStart = useCallback((event) => {
    const data = event.active.data.current;
    setIsDragging(true);
    if (data?.fromPalette) {
      setActiveDrag({ kind: "palette", type: data.type });
    } else if (data?.type === "quick-link") {
      const nodeId = data.nodeId || parseQuickLinkDragId(event.active.id);
      const node = nodes.find((n) => n.id === nodeId);
      setActiveDrag({ kind: "quick-link", node });
    } else {
      const node = nodes.find((n) => n.id === event.active.id);
      setActiveDrag({ kind: "nav-node", node });
    }
  }, [nodes]);

  const handleDragCancel = useCallback(() => {
    setIsDragging(false);
    setActiveDrag(null);
  }, []);

  const handleDragEnd = useCallback(
    (event) => {
      setIsDragging(false);
      setActiveDrag(null);
      const { active, over } = event;
      if (!over) return;

      const activeData = active.data.current;
      const overData = over.data?.current;

      if (activeData?.fromPalette) {
        const type = activeData.type;
        if (over.id === "quick-links") return;

        const target = resolveDropParent(nodes, overData, over.id);
        if (!target) return;

        if (!canCreateTypeAtParent(type, target.parentId)) {
          showError("Add pages inside a link group.");
          return;
        }

        if (!canDropAt(nodes, null, target.parentId, maxLevel)) {
          showError("Maximum navigation depth reached.");
          return;
        }

        const newNode = createNode(type, target.parentId, nodes);
        if (!newNode) {
          showError("Add pages inside a link group.");
          return;
        }
        setNodes((prev) => {
          const withNew = [...prev, newNode];
          return reparentNode(withNew, newNode.id, target.parentId, target.index);
        });
        return;
      }

      const activeQuickLinkId = parseQuickLinkDragId(active.id);
      const activeNodeId = activeQuickLinkId || active.id;
      const activeNode = nodes.find((n) => n.id === activeNodeId);
      if (!activeNode) return;

      const overQuickLinkId = parseQuickLinkDragId(over.id);
      const overNodeId = overQuickLinkId || (overData?.nodeId ?? over.id);

      if (activeQuickLinkId) {
        if (overQuickLinkId) {
          const links = sortQuickLinks(nodes);
          const newIndex = links.findIndex((n) => n.id === overQuickLinkId);
          if (newIndex !== -1) {
            setNodes((prev) => reorderQuickLinks(prev, activeQuickLinkId, newIndex));
          }
          return;
        }
        if (
          overData?.type === "column" ||
          overData?.type === "nav-node" ||
          overData?.type === "drop-into" ||
          overData?.type === "drop-before" ||
          overData?.type === "drop-after"
        ) {
          setNodes((prev) => removeFromQuickLinks(prev, activeQuickLinkId));
          return;
        }
      }

      if (over.id === "quick-links" || overData?.type === "quick-links") {
        setNodes((prev) => addToQuickLinks(prev, activeNodeId));
        return;
      }

      if (activeQuickLinkId && overQuickLinkId) {
        const links = sortQuickLinks(nodes);
        const newIndex = links.findIndex((n) => n.id === overQuickLinkId);
        if (newIndex !== -1) {
          setNodes((prev) => reorderQuickLinks(prev, activeQuickLinkId, newIndex));
        }
        return;
      }

      if (activeQuickLinkId) return;

      if (overData?.type === "drop-before") {
        if (!canDropAt(nodes, activeNodeId, nodes.find((n) => n.id === overData.nodeId)?.parentId ?? null, maxLevel)) {
          showError("Maximum navigation depth reached.");
          return;
        }
        setNodes((prev) => moveNode(prev, activeNodeId, overData.nodeId, "before"));
        return;
      }

      if (overData?.type === "drop-after") {
        if (!canDropAt(nodes, activeNodeId, nodes.find((n) => n.id === overData.nodeId)?.parentId ?? null, maxLevel)) {
          showError("Maximum navigation depth reached.");
          return;
        }
        setNodes((prev) => moveNode(prev, activeNodeId, overData.nodeId, "after"));
        return;
      }

      if (overData?.type === "drop-into") {
        if (!canDropAt(nodes, activeNodeId, overData.nodeId, maxLevel)) {
          showError("Maximum navigation depth reached.");
          return;
        }
        const siblings = getSiblings(nodes, overData.nodeId);
        setNodes((prev) => reparentNode(prev, activeNodeId, overData.nodeId, siblings.length));
        return;
      }

      if (overData?.type === "column") {
        if (!canDropAt(nodes, activeNodeId, overData.columnId, maxLevel)) {
          showError("Maximum navigation depth reached.");
          return;
        }
        const siblings = getSiblings(nodes, overData.columnId);
        setNodes((prev) => reparentNode(prev, activeNodeId, overData.columnId, siblings.length));
        return;
      }

      if (overQuickLinkId) {
        setNodes((prev) =>
          reorderQuickLinks(
            prev,
            activeNodeId,
            sortQuickLinks(prev).findIndex((n) => n.id === overQuickLinkId),
          ),
        );
        return;
      }

      if (activeNodeId !== overNodeId && nodes.find((n) => n.id === overNodeId)) {
        const overNode = nodes.find((n) => n.id === overNodeId);
        if (!canDropAt(nodes, activeNodeId, overNode?.parentId ?? null, maxLevel)) {
          showError("Maximum navigation depth reached.");
          return;
        }
        setNodes((prev) => moveNode(prev, activeNodeId, overNodeId, "after"));
      }
    },
    [nodes, maxLevel, showError],
  );

  const handleSave = async () => {
    setSaving(true);
    try {
      const db = getFirebaseFirestore();
      const { nodes: syncedNodes, pageUpdates } = syncPageSlugs(nodes);
      const flat = flattenNavTree(buildNavTree(syncedNodes));
      const batch = writeBatch(db);

      const existingIds = new Set(initialNodes.map((n) => n.id));
      const existingPageIds = new Set(initialNodes.map((n) => n.pageId).filter(Boolean));
      const newIds = new Set(flat.map((n) => n.id));

      for (const id of existingIds) {
        if (!newIds.has(id)) {
          batch.delete(doc(db, COLLECTIONS.navNodes, id));
        }
      }

      for (const node of flat) {
        batch.set(
          doc(db, COLLECTIONS.navNodes, node.id),
          serializeNavNode(node),
          { merge: true },
        );
      }

      const now = new Date().toISOString();
      for (const [pageId, { slug, title }] of pageUpdates) {
        const pageRef = doc(db, COLLECTIONS.pages, pageId);
        if (existingPageIds.has(pageId)) {
          batch.set(
            pageRef,
            {
              slug,
              title,
              seo: { title },
              updatedAt: now,
            },
            { merge: true },
          );
        } else {
          const navNode = syncedNodes.find((n) => n.pageId === pageId);
          const parentNode = navNode?.parentId
            ? syncedNodes.find((n) => n.id === navNode.parentId)
            : null;
          const inLinkGroup = parentNode?.type === "group";

          batch.set(
            pageRef,
            {
              slug,
              title,
              status: "draft",
              pageType: "content",
              layout: inLinkGroup ? "sidebar-left" : "default",
              contentColumns: 1,
              maxModulesPerRegion: 10,
              regions: inLinkGroup
                ? [
                    { id: "features", modules: [] },
                    { id: "content-1", modules: [] },
                    { id: "sidebar", modules: [] },
                  ]
                : [
                    { id: "features", modules: [] },
                    { id: "content-1", modules: [] },
                  ],
              seo: { title },
              updatedAt: now,
            },
            { merge: true },
          );
        }
      }

      await batch.commit();
      setNodes(syncedNodes);
      router.refresh();
    } catch (err) {
      console.error("Sitemap save failed:", err);
      showError(err?.message || "Failed to save sitemap. Check that you are signed in as an admin.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="sitemap-editor flex h-full flex-col bg-muted">
      <div className="border-b border-border bg-card px-6 py-4 shadow-sm">
        <h1 className="text-lg font-semibold text-foreground">Edit Site Map and Quick Links</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Drag pages to reorganize navigation and quick links.
        </p>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={pointerWithin}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div
          className="relative min-h-0 flex-1 overflow-auto p-6"
          style={{ paddingBottom: "calc(var(--sitemap-bottom-bar-height) + 1rem)" }}
        >
          {isDragging && activeDrag?.kind === "palette" && (
            <div className="pointer-events-none absolute inset-0 z-10 bg-black/5" />
          )}

          <QuickLinksBar quickLinks={quickLinks} />

          <div id="navAdmin" className="sitemap-nav-admin overflow-x-auto pb-4">
            <ul className="flex gap-3">
              {tree.map((column) => (
                <NavColumn
                  key={column.id}
                  column={column}
                  allNodes={nodes}
                  maxLevel={maxLevel}
                  pageTypeMap={pageTypeMap}
                  onRename={handleRename}
                  onDelete={handleDelete}
                  onView={handleView}
                  onSettings={handleSettings}
                />
              ))}
            </ul>
          </div>
        </div>

        <div
          id="navAdminNewBackground"
          className="sitemap-bottom-bar fixed inset-x-0 bottom-0 z-50 border-t border-border bg-muted shadow-[0_-4px_12px_rgba(0,0,0,0.06)]"
        >
          {dropError && (
            <div className="bg-amber-100 px-4 py-2 text-center text-sm text-amber-900">{dropError}</div>
          )}
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 px-6 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Drag to add:
              </span>
              {TEMPLATE_TYPES.map((type) => (
                <NavTemplateTile key={type} type={type} onAdd={addTemplate} />
              ))}
            </div>
          </div>
          <div
            className="flex items-center justify-between border-t border-border/80 bg-card/95 px-6 backdrop-blur-md"
            style={{ height: "var(--admin-page-nav-height)" }}
          >
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span>
                Levels:{" "}
                {[2, 3, 4].map((l) => (
                  <button
                    key={l}
                    type="button"
                    onClick={() => setMaxLevel(l)}
                    className={`mx-1 rounded px-2 py-0.5 ${
                      maxLevel === l ? "bg-emerald-600 text-white" : "bg-muted hover:bg-muted/80"
                    }`}
                  >
                    {l}
                  </button>
                ))}
              </span>
              <span>{pageCount} pages used</span>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => router.push("/builder/edit")}
                className="rounded border border-border px-4 py-2 text-sm hover:bg-muted"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="rounded bg-emerald-600 px-6 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>

        <DragOverlay dropAnimation={{ duration: 200, easing: "ease" }}>
          {activeDrag?.kind === "palette" && (
            <div
              className={`rounded px-4 py-2.5 text-sm font-medium text-white shadow-lg ${NAV_TEMPLATE_STYLES[activeDrag.type]}`}
            >
              {NAV_TEMPLATE_LABELS[activeDrag.type]}
            </div>
          )}
          {activeDrag?.kind === "nav-node" && activeDrag.node && (
            <div className="rounded bg-primary px-3 py-2 text-sm text-primary-foreground shadow-lg">
              {activeDrag.node.title}
            </div>
          )}
          {activeDrag?.kind === "quick-link" && activeDrag.node && (
            <span className="inline-flex rounded-full bg-amber-500 px-3 py-1 text-sm font-medium text-white shadow-lg">
              {activeDrag.node.title}
            </span>
          )}
        </DragOverlay>
      </DndContext>

      <PageSettingsSheet
        open={settingsOpen}
        page={settingsPage}
        onClose={() => {
          setSettingsOpen(false);
          setSettingsPage(null);
        }}
        onSave={handlePageSettingsSave}
      />
    </div>
  );
}
