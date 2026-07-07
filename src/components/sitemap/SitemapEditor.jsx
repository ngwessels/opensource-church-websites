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
import { doc, getDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { PageSettingsSheet } from "@/components/builder/PageSettingsSheet";
import { getPageType } from "@/lib/bulletins/schema";
import { useAuth } from "@/hooks/useAuth";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useSiteConfig } from "@/hooks/useSiteConfig";
import { requestPublicRevalidate } from "@/lib/cache/revalidate-client";

import { getFirebaseFirestore } from "@/lib/firebase/firestore";
import { auditedUpdateDoc, auditedWriteBatch, buildClientAuditActor } from "@/lib/firestore/audited-mutation";
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

import { Button } from "@/components/ui/button";
import { ADMIN_PAGE_NAV_HEIGHT } from "@/lib/design/admin-tokens";
import { cn } from "@/lib/utils";

import { DeleteNavNodeDialog } from "./DeleteNavNodeDialog";
import { NavColumn } from "./NavColumn";
import { NAV_TEMPLATE_TYPES } from "./nav-type-meta";
import { NavTemplateTile, NAV_TEMPLATE_LABELS, NAV_TEMPLATE_STYLES } from "./NavTemplateTile";
import { QuickLinksBar, parseQuickLinkDragId } from "./QuickLinksBar";
import { SitemapDndProvider } from "./SitemapDndContext";

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
  const { user } = useAuth();
  const { profile } = useUserProfile();
  const { config } = useSiteConfig();
  const [nodes, setNodes] = useState(initialNodes);
  const [maxLevel, setMaxLevel] = useState(4);
  const [saving, setSaving] = useState(false);
  const [activeDrag, setActiveDrag] = useState(null);
  const [dropError, setDropError] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [pageTypeMap, setPageTypeMap] = useState({});
  const [pageHiddenMap, setPageHiddenMap] = useState({});
  const [settingsPage, setSettingsPage] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

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

  const handleQuickLinkRename = useCallback((id, title) => {
    setNodes((prev) => prev.map((n) => (n.id === id ? { ...n, title } : n)));
  }, []);

  const handleRemoveFromQuickLinks = useCallback((id) => {
    setNodes((prev) => removeFromQuickLinks(prev, id));
  }, []);

  const handleUpdateExternalUrl = useCallback((id, externalUrl) => {
    setNodes((prev) =>
      prev.map((n) => (n.id === id ? { ...n, externalUrl: externalUrl || "https://" } : n)),
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

  const handleDeleteRequest = useCallback((node) => {
    setDeleteTarget(node);
  }, []);

  const handleDeleteConfirm = useCallback(() => {
    if (!deleteTarget) return;
    handleDelete(deleteTarget.id);
    setDeleteTarget(null);
  }, [deleteTarget, handleDelete]);

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
      setPageHiddenMap({});
      return;
    }

    let cancelled = false;

    (async () => {
      const entries = await Promise.all(
        pageIds.map(async (pageId) => {
          const snap = await getDoc(doc(db, COLLECTIONS.pages, pageId));
          const data = snap.exists() ? snap.data() : null;
          return [
            pageId,
            {
              type: data ? getPageType(data) : "content",
              hidden: data?.hidden === true,
            },
          ];
        }),
      );
      if (!cancelled) {
        setPageTypeMap(Object.fromEntries(entries.map(([id, meta]) => [id, meta.type])));
        setPageHiddenMap(Object.fromEntries(entries.map(([id, meta]) => [id, meta.hidden])));
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
      const pageRef = doc(db, COLLECTIONS.pages, settingsPage.id);
      const patch = { ...updates, updatedAt: now };
      const actor = buildClientAuditActor(user, profile);
      if (actor) {
        await auditedUpdateDoc(pageRef, patch, {
          actor,
          action: "update",
          resource: { type: "page", id: settingsPage.id, slug: settingsPage.slug },
          summary: `Updated page settings for ${settingsPage.title || settingsPage.id}`,
          context: { builderPath: "/builder/sitemap", section: "page-settings" },
        });
      } else {
        const { updateDoc } = await import("firebase/firestore");
        await updateDoc(pageRef, patch);
      }
      setSettingsPage((prev) => (prev ? { ...prev, ...updates, updatedAt: now } : prev));
      setPageTypeMap((prev) => ({
        ...prev,
        [settingsPage.id]: updates.pageType || getPageType(settingsPage),
      }));
    },
    [settingsPage, user, profile],
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

      const existingIds = new Set(initialNodes.map((n) => n.id));
      const existingPageIds = new Set(initialNodes.map((n) => n.pageId).filter(Boolean));
      const newIds = new Set(flat.map((n) => n.id));

      const applyWrites = (batch) => {
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
      };

      const actor = buildClientAuditActor(user, profile);
      if (actor) {
        await auditedWriteBatch(db, applyWrites, {
          actor,
          action: "update",
          resource: { type: "nav", path: "navNodes" },
          summary: `Saved sitemap (${flat.length} nodes)`,
          context: { builderPath: "/builder/sitemap", section: "sitemap" },
          before: initialNodes,
          after: syncedNodes,
        });
      } else {
        const { writeBatch } = await import("firebase/firestore");
        const batch = writeBatch(db);
        applyWrites(batch);
        await batch.commit();
      }
      await requestPublicRevalidate({
        getIdToken: () => user?.getIdToken(),
        scope: "site",
      });
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
      <div className="border-b border-border bg-card px-6 py-5 shadow-sm">
        <h1 className="text-lg font-semibold text-foreground">Site Map &amp; Quick Links</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Each column is a top-level menu item. Drag to reorder, nest under link groups, or add
          shortcuts to the header quick links bar.
        </p>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={pointerWithin}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <SitemapDndProvider isDragging={isDragging}>
          <div
            className="relative min-h-0 flex-1 overflow-auto px-6 py-5"
            style={{ paddingBottom: "calc(var(--sitemap-bottom-bar-height) + 1rem)" }}
          >
            {isDragging && (
              <div className="pointer-events-none absolute inset-0 z-10 bg-background/40 backdrop-blur-[1px]" />
            )}

            <QuickLinksBar
              quickLinks={quickLinks}
              nodes={nodes}
              onRename={handleQuickLinkRename}
              onRemove={handleRemoveFromQuickLinks}
              onUpdateExternalUrl={handleUpdateExternalUrl}
            />

            <section>
              <div className="mb-3 flex items-baseline justify-between gap-4">
                <div>
                  <h2 className="text-sm font-semibold text-foreground">Main Navigation</h2>
                  <p className="text-xs text-muted-foreground">
                    {tree.length} top-level {tree.length === 1 ? "item" : "items"}
                  </p>
                </div>
                {tree.length > 4 && (
                  <p className="shrink-0 text-xs text-muted-foreground">Scroll horizontally →</p>
                )}
              </div>

              <div
                id="navAdmin"
                className="sitemap-nav-admin -mx-1 overflow-x-auto px-1 pb-2"
              >
                <ul className="flex gap-4">
                  {tree.map((column) => (
                    <NavColumn
                      key={column.id}
                      column={column}
                      allNodes={nodes}
                      maxLevel={maxLevel}
                      pageTypeMap={pageTypeMap}
                      pageHiddenMap={pageHiddenMap}
                      onRename={handleRename}
                      onDelete={handleDeleteRequest}
                      onView={handleView}
                      onSettings={handleSettings}
                    />
                  ))}
                </ul>
              </div>
            </section>
          </div>

          {dropError && (
            <div
              className="fixed left-1/2 top-20 z-[60] -translate-x-1/2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm font-medium text-amber-900 shadow-lg dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100"
              role="alert"
            >
              {dropError}
            </div>
          )}

          <div
            id="navAdminNewBackground"
            className="sitemap-bottom-bar fixed inset-x-0 bottom-0 z-50 border-t border-border bg-muted/95 shadow-[0_-4px_24px_rgba(0,0,0,0.08)] backdrop-blur-md"
          >
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border/60 px-6 py-3">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Add new
              </span>
              <div className="flex flex-wrap items-center gap-2">
                {NAV_TEMPLATE_TYPES.map((type) => (
                  <NavTemplateTile key={type} type={type} onAdd={addTemplate} />
                ))}
              </div>
              <span className="hidden text-xs text-muted-foreground sm:inline">
                Drag onto a column or click to add at the top level
              </span>
            </div>
            <div
              className="flex items-center justify-between gap-4 bg-card/95 px-6"
              style={{ height: ADMIN_PAGE_NAV_HEIGHT }}
            >
              <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium uppercase tracking-wide">Depth</span>
                  <div
                    className="flex items-center rounded-lg border border-border/90 bg-muted/80 p-0.5"
                    role="group"
                    aria-label="Maximum navigation depth"
                  >
                    {[2, 3, 4].map((l) => (
                      <button
                        key={l}
                        type="button"
                        onClick={() => setMaxLevel(l)}
                        className={cn(
                          "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                          maxLevel === l
                            ? "bg-primary text-primary-foreground shadow-sm"
                            : "text-muted-foreground hover:bg-card hover:text-foreground",
                        )}
                      >
                        {l} levels
                      </button>
                    ))}
                  </div>
                </div>
                <span className="hidden h-4 w-px bg-border sm:block" aria-hidden />
                <span>{pageCount} pages</span>
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push("/builder/edit")}
                >
                  Cancel
                </Button>
                <Button type="button" onClick={handleSave} disabled={saving}>
                  {saving ? "Saving…" : "Save changes"}
                </Button>
              </div>
            </div>
          </div>

          <DragOverlay dropAnimation={{ duration: 200, easing: "ease" }}>
            {activeDrag?.kind === "palette" && (
              <div
                className={cn(
                  "inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium shadow-xl",
                  NAV_TEMPLATE_STYLES[activeDrag.type],
                )}
              >
                {NAV_TEMPLATE_LABELS[activeDrag.type]}
              </div>
            )}
            {activeDrag?.kind === "nav-node" && activeDrag.node && (
              <div className="rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground shadow-xl">
                {activeDrag.node.title}
              </div>
            )}
            {activeDrag?.kind === "quick-link" && activeDrag.node && (
              <span className="inline-flex items-center rounded-full border border-amber-600/30 bg-amber-500 px-4 py-2 text-sm font-medium text-white shadow-xl">
                {activeDrag.node.title}
              </span>
            )}
          </DragOverlay>
        </SitemapDndProvider>
      </DndContext>

      <PageSettingsSheet
        open={settingsOpen}
        page={settingsPage}
        pageTitle={settingsPage?.title}
        siteName={config?.name}
        siteSeo={config?.seo}
        onClose={() => {
          setSettingsOpen(false);
          setSettingsPage(null);
        }}
        onSave={handlePageSettingsSave}
      />

      <DeleteNavNodeDialog
        node={deleteTarget}
        nodes={nodes}
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
}
