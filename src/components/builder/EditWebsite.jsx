"use client";

import {
  closestCenter,
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { doc, updateDoc } from "firebase/firestore";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { PublicSite } from "@/components/site/PublicSite";
import { getPageType } from "@/lib/bulletins/schema";
import { useBulletins } from "@/hooks/useBulletins";
import { getFirebaseFirestore } from "@/lib/firebase/firestore";
import { COLLECTIONS } from "@/lib/firestore/paths";
import { getDefaultConfig } from "@/lib/modules/defaults";
import { publishPage, revertPageDraft } from "@/lib/pages/publish";
import {
  clearFeaturesRegion,
  FEATURES_REGION_ID,
  findModuleRegionId,
  getDropValidationError,
  getRegionModules,
  insertModuleAt,
  moveModule,
  normalizePageRegions,
  removeModuleById,
} from "@/lib/pages/regions";
import { MODULE_LABELS } from "@/lib/design/admin-tokens";
import { buildNavTree, generateId, sortQuickLinks } from "@/lib/sitemap/tree";
import { useNavNodes } from "@/hooks/useNavNodes";
import { useSiteConfig } from "@/hooks/useSiteConfig";

import { AdminFooter } from "./AdminFooter";
import { HeaderFooterSheet } from "./HeaderFooterSheet";
import { ModuleEditor } from "./ModuleEditor";
import { ModuleTile } from "./ModuleTile";
import { PageSettingsSheet } from "./PageSettingsSheet";
import { RemoveModuleDialog } from "./RemoveModuleDialog";
export function EditWebsite({ slug = "" }) {
  const router = useRouter();
  const { config } = useSiteConfig();
  const { nodes } = useNavNodes();
  const [page, setPage] = useState(null);
  const [pageId, setPageId] = useState(null);
  const [trayOpen, setTrayOpen] = useState(false);
  const [editingModule, setEditingModule] = useState(null);
  const [sectionSheet, setSectionSheet] = useState(null);
  const [pageSettingsOpen, setPageSettingsOpen] = useState(false);
  const [dragType, setDragType] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dropError, setDropError] = useState(null);
  const [toast, setToast] = useState(null);
  const [moduleToRemove, setModuleToRemove] = useState(null);
  const [removingModule, setRemovingModule] = useState(false);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
  );

  const navTree = buildNavTree(nodes);
  const quickLinks = sortQuickLinks(nodes);
  const { bulletins } = useBulletins();
  const isBulletinsPage = getPageType(page) === "bulletins";

  const showToast = (message) => {
    setToast(message);
    setTimeout(() => setToast(null), 2500);
  };

  const showError = (message) => {
    setDropError(message);
    setTimeout(() => setDropError(null), 4000);
  };

  const loadPage = useCallback(async () => {
    const db = getFirebaseFirestore();
    const { collection, query, where, getDocs } = await import("firebase/firestore");
    const q = query(collection(db, COLLECTIONS.pages), where("slug", "==", slug));
    const snap = await getDocs(q);
    if (!snap.empty) {
      const d = snap.docs[0];
      const raw = d.data();
      const normalized = normalizePageRegions(raw);
      setPageId(d.id);
      setPage(normalized);
      if (normalized !== raw) {
        await updateDoc(doc(db, COLLECTIONS.pages, d.id), {
          regions: normalized.regions,
          contentColumns: normalized.contentColumns,
          maxModulesPerRegion: normalized.maxModulesPerRegion,
          updatedAt: new Date().toISOString(),
        });
      }
    }
  }, [slug]);

  useEffect(() => {
    loadPage();
  }, [loadPage]);

  const updatePage = async (updates) => {
    if (!pageId) return;
    const db = getFirebaseFirestore();
    await updateDoc(doc(db, COLLECTIONS.pages, pageId), {
      ...updates,
      updatedAt: new Date().toISOString(),
    });
    setPage((prev) => ({ ...prev, ...updates }));
  };

  const handleAddModule = async (type, region = "content-1", insertIndex) => {
    const mod = {
      id: generateId(),
      type,
      region,
      order: insertIndex ?? 0,
      config: getDefaultConfig(type),
    };

    const regions = insertModuleAt(page?.regions || [], region, mod, insertIndex);
    const updates = { regions };
    if (type === "slideshow" && region === FEATURES_REGION_ID) {
      updates.heroSlideshowEnabled = true;
    }
    await updatePage(updates);
    const added = regions.flatMap((r) => r.modules).find((m) => m.id === mod.id);
    if (type !== "text") {
      setEditingModule(added || mod);
    }
    setDropError(null);
  };

  const handleSaveModule = async (moduleConfig) => {
    if (!editingModule) return;
    await handleSaveModuleConfig(editingModule.id, moduleConfig);
    setEditingModule(null);
  };

  const handleSaveModuleConfig = async (moduleId, moduleConfig) => {
    const regions = page.regions.map((r) => ({
      ...r,
      modules: r.modules.map((m) => {
        if (m.id !== moduleId) return m;
        const config = { ...m.config, ...moduleConfig };
        if (m.type === "mass_times" && config.useSiteDefaults === true) {
          delete config.times;
        }
        if (m.type === "calendar") {
          if (config.source === "google") {
            delete config.events;
          } else {
            delete config.googleCalendarId;
          }
        }
        return { ...m, config };
      }),
    }));
    await updatePage({ regions });
  };

  const handlePublish = async () => {
    if (!pageId) return;
    try {
      await publishPage(getFirebaseFirestore(), pageId);
      await loadPage();
      showToast("Page published.");
    } catch (err) {
      showError(err instanceof Error ? err.message : "Failed to publish page.");
    }
  };

  const handleRevert = async () => {
    if (pageId) {
      await revertPageDraft(getFirebaseFirestore(), pageId);
      await loadPage();
    }
  };

  const handlePageSettingsSave = async (updates) => {
    await updatePage(updates);
    await loadPage();
  };

  const resolveDropTarget = (over) => {
    if (!over?.data?.current) return null;
    const data = over.data.current;
    if (data.kind === "features") {
      return { regionId: FEATURES_REGION_ID, index: 0 };
    }
    if (data.kind === "insert") {
      return { regionId: data.regionId, index: data.index };
    }
    if (data.kind === "region-end") {
      return { regionId: data.regionId, index: data.index };
    }
    if (data.moduleId) {
      const regionId = data.regionId ?? findModuleRegionId(page, data.moduleId);
      if (!regionId) return null;
      const modules = getRegionModules(page, regionId);
      const idx = modules.findIndex((m) => m.id === data.moduleId);
      if (idx >= 0) return { regionId, index: idx + 1 };
    }
    return null;
  };

  const handleDragStart = (event) => {
    const data = event.active.data.current;
    const type = data?.type;
    if (type) setDragType(type);
    setIsDragging(true);
    setDropError(null);
  };

  const handleDragEnd = async (event) => {
    setDragType(null);
    setIsDragging(false);
    const { active, over } = event;
    if (!over) return;

    const activeData = active.data.current;
    const target = resolveDropTarget(over);
    if (!target) return;

    const { regionId, index } = target;
    const type = activeData?.type;

    if (activeData?.fromTray) {
      const error = getDropValidationError(type, regionId, page);
      if (error) {
        showError(error);
        return;
      }
      await handleAddModule(type, regionId, index);
      return;
    }

    const moduleId = activeData?.moduleId;
    if (!moduleId) return;

    const sourceRegionId = activeData.regionId ?? findModuleRegionId(page, moduleId);
    const overModuleId = over.data.current?.moduleId;

    if (
      overModuleId &&
      sourceRegionId &&
      sourceRegionId === (over.data.current?.regionId ?? findModuleRegionId(page, overModuleId)) &&
      moduleId !== overModuleId
    ) {
      const modules = getRegionModules(page, sourceRegionId);
      const oldIndex = modules.findIndex((m) => m.id === moduleId);
      const newIndex = modules.findIndex((m) => m.id === overModuleId);
      if (oldIndex >= 0 && newIndex >= 0 && oldIndex !== newIndex) {
        const error = getDropValidationError(type, sourceRegionId, page, { excludeModuleId: moduleId });
        if (error) {
          showError(error);
          return;
        }
        const reordered = arrayMove(modules, oldIndex, newIndex);
        const regions = page.regions.map((r) =>
          r.id === sourceRegionId
            ? {
                ...r,
                modules: reordered.map((m, i) => ({ ...m, order: i, region: sourceRegionId })),
              }
            : r,
        );
        await updatePage({ regions });
        return;
      }
    }

    const error = getDropValidationError(type, regionId, page, { excludeModuleId: moduleId });
    if (error) {
      showError(error);
      return;
    }

    const regions = moveModule(page.regions, moduleId, regionId, index);
    await updatePage({ regions });
  };

  const handleDragCancel = () => {
    setDragType(null);
    setIsDragging(false);
  };

  const handleRemoveModule = async (module) => {
    if (!module?.id) return;
    try {
      let regions = removeModuleById(page.regions, module.id);
      const updates = { regions };

      if (module.type === "slideshow" && findModuleRegionId(page, module.id) === FEATURES_REGION_ID) {
        regions = clearFeaturesRegion(regions);
        updates.regions = regions;
        updates.heroSlideshowEnabled = false;
      }

      await updatePage(updates);
      if (editingModule?.id === module.id) setEditingModule(null);
      const label = MODULE_LABELS[module.type] || module.type;
      showToast(`${label} removed`);
    } catch (e) {
      showError(e.message || "Failed to remove module.");
    }
  };

  const requestRemoveModule = (module) => {
    if (module?.id) setModuleToRemove(module);
  };

  const confirmRemoveModule = async () => {
    if (!moduleToRemove || removingModule) return;
    setRemovingModule(true);
    try {
      await handleRemoveModule(moduleToRemove);
      setModuleToRemove(null);
    } finally {
      setRemovingModule(false);
    }
  };

  const handleTrayAdd = (type) => {
    if (type === "slideshow") {
      showError("Drag Slideshow onto the features area above your content.");
      return;
    }
    handleAddModule(type, "content-1");
    setTrayOpen(false);
    showToast(`Added ${type} to column 1`);
  };

  if (!page) {
    return <div className="flex h-full items-center justify-center text-muted-foreground">Loading page…</div>;
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div
        className={`relative min-h-full ${trayOpen ? "module-tray-extended" : ""}`}
        style={{ paddingBottom: "var(--admin-page-nav-height)" }}
      >
        {isDragging && !isBulletinsPage && (
          <div className="drag-dim-overlay pointer-events-none absolute inset-0 z-20 bg-black/10" />
        )}

        {isBulletinsPage && (
          <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-sm text-amber-900">
            This is a Bulletins page. Manage bulletin PDFs in the{" "}
            <Link href="/builder/bulletins" className="font-medium underline">
              Bulletins tab
            </Link>
            .
          </div>
        )}

        <PublicSite
          siteConfig={config}
          navTree={navTree}
          navNodes={nodes}
          quickLinks={quickLinks}
          page={page}
          pageId={pageId}
          bulletins={bulletins}
          editing
          trayOpen={trayOpen}
          isDragActive={isDragging}
          dragType={dragType}
          onEditModule={setEditingModule}
          onSaveModule={handleSaveModuleConfig}
          onRemoveModule={requestRemoveModule}
          onRemoveSlideshow={requestRemoveModule}
          onEditSlideshow={setEditingModule}
          onHeaderSettings={(focus) => setSectionSheet({ section: "header", focus })}
          onFooterSettings={() => setSectionSheet("footer")}
        />

        {toast && (
          <div className="fixed left-1/2 top-4 z-[60] -translate-x-1/2 rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground shadow-lg">
            {toast}
          </div>
        )}
      </div>

      <AdminFooter
        trayOpen={trayOpen}
        hideContentTray={isBulletinsPage}
        onCloseTray={() => setTrayOpen(false)}
        onAddModule={handleTrayAdd}
        onAddContent={() => setTrayOpen((o) => !o)}
        onAddPage={() => router.push("/builder/sitemap")}
        onDuplicate={() => {}}
        onDelete={() => {}}
        onPageSettings={() => setPageSettingsOpen(true)}
        onRevert={handleRevert}
        onPreview={() => window.open(slug ? `/${slug}` : "/", "_blank")}
        onPublish={handlePublish}
        dropError={dropError}
      />

      <DragOverlay dropAnimation={{ duration: 200, easing: "ease" }}>
        {dragType ? <ModuleTile type={dragType} isOverlay /> : null}
      </DragOverlay>

      <ModuleEditor
        module={editingModule}
        siteConfig={config}
        pageId={pageId}
        onSave={handleSaveModule}
        onClose={() => setEditingModule(null)}
      />

      <HeaderFooterSheet
        open={!!sectionSheet}
        section={typeof sectionSheet === "string" ? sectionSheet : sectionSheet?.section}
        focus={typeof sectionSheet === "object" ? sectionSheet?.focus : undefined}
        siteConfig={config}
        navNodes={nodes}
        onClose={() => setSectionSheet(null)}
        onSaved={() => {}}
      />

      <PageSettingsSheet
        open={pageSettingsOpen}
        page={page}
        onClose={() => setPageSettingsOpen(false)}
        onSave={handlePageSettingsSave}
      />

      <RemoveModuleDialog
        module={moduleToRemove}
        open={!!moduleToRemove}
        onOpenChange={(open) => {
          if (!open && !removingModule) setModuleToRemove(null);
        }}
        onConfirm={confirmRemoveModule}
        removing={removingModule}
      />

    </DndContext>
  );
}
