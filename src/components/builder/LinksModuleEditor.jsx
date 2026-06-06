"use client";

import { ExternalLink, Globe, Link2, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ADMIN_Z } from "@/lib/design/admin-tokens";
import { useNavNodes } from "@/hooks/useNavNodes";
import { resolveNavHref } from "@/lib/sitemap/tree";
import { cn } from "@/lib/utils";

const overlayZ = { zIndex: ADMIN_Z.overlay };

function navNodeHref(node, allNodes) {
  return resolveNavHref(allNodes, node);
}

function flattenPickableTree(tree, depth = 0) {
  const result = [];
  for (const node of tree) {
    if (node.type === "page" || node.type === "secure_page" || node.type === "link") {
      result.push({ node, depth });
    }
    if (node.children?.length) {
      result.push(...flattenPickableTree(node.children, depth + 1));
    }
  }
  return result;
}

function createLinkItem(item = { label: "", href: "" }, nodes = []) {
  const href = item.href?.trim() || "";
  const isExternal = /^https?:\/\//i.test(href);
  const matchedNode = href ? nodes.find((n) => navNodeHref(n, nodes) === href) : null;

  if (matchedNode) {
    return {
      label: item.label || "",
      href,
      source: "site",
      nodeId: matchedNode.id,
    };
  }

  if (isExternal || href) {
    return {
      label: item.label || "",
      href,
      source: "external",
      nodeId: "",
    };
  }

  return { label: item.label || "", href: "", source: "site", nodeId: "" };
}

function nodeTypeLabel(type) {
  if (type === "secure_page") return "Secure";
  if (type === "link") return "External";
  return null;
}

export function LinksModuleEditor({ module, onSave, onClose }) {
  const { nodes, tree, loading } = useNavNodes();
  const [title, setTitle] = useState(module.config?.title || "");
  const [items, setItems] = useState(() => {
    const saved = module.config?.items;
    if (saved?.length) return saved.map((item) => createLinkItem(item, nodes));
    return [createLinkItem()];
  });

  const pickableEntries = useMemo(() => flattenPickableTree(tree), [tree]);
  const nodesSynced = useRef(false);

  useEffect(() => {
    if (loading || nodes.length === 0 || nodesSynced.current) return;
    nodesSynced.current = true;
    setItems((prev) =>
      prev.map((item) => createLinkItem({ label: item.label, href: item.href }, nodes)),
    );
  }, [loading, nodes]);

  const updateItem = (index, patch) => {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  };

  const setSource = (index, source) => {
    setItems((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;
        if (source === "site") {
          return { ...item, source, href: "", nodeId: "" };
        }
        return { ...item, source, nodeId: "" };
      }),
    );
  };

  const pickPage = (index, nodeId) => {
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return;
    const href = navNodeHref(node, nodes);
    updateItem(index, {
      nodeId,
      href,
      source: "site",
      label: items[index].label.trim() ? items[index].label : node.title || "",
    });
  };

  const removeItem = (index) => {
    setItems((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));
  };

  const addItem = () => {
    setItems((prev) => [...prev, createLinkItem()]);
  };

  const handleSave = () => {
    onSave({
      title: title.trim(),
      items: items
        .filter((item) => item.label.trim() && item.href.trim())
        .map(({ label, href }) => ({ label: label.trim(), href: href.trim() })),
    });
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/50 p-4" style={overlayZ}>
      <div className="flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-xl bg-card shadow-2xl">
        <div className="flex items-start gap-3 border-b border-border bg-muted/80 px-5 py-4">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-amber-500 text-white shadow-sm">
            <Link2 className="size-5" />
          </div>
          <div className="min-w-0 flex-1 space-y-3">
            <div>
              <h2 className="text-base font-semibold text-foreground">Edit links</h2>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Add quick links to site pages or external URLs.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="links-section-title" className="text-muted-foreground">
                Section title
              </Label>
              <Input
                id="links-section-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Quick links"
                className="h-9 bg-card"
              />
            </div>
          </div>
        </div>

        <div className="flex-1 space-y-3 overflow-auto p-5">
          {items.map((item, i) => (
            <div
              key={i}
              className="rounded-lg border border-border bg-card shadow-sm"
            >
              <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
                <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  Link {i + 1}
                </span>
                {items.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    onClick={() => removeItem(i)}
                    className="h-7 gap-1 text-red-600 hover:bg-red-50 hover:text-red-700"
                  >
                    <Trash2 className="size-3.5" />
                    Remove
                  </Button>
                )}
              </div>

              <div className="space-y-4 p-4">
                <div className="space-y-1.5">
                  <Label htmlFor={`link-label-${i}`}>Display label</Label>
                  <Input
                    id={`link-label-${i}`}
                    value={item.label}
                    onChange={(e) => updateItem(i, { label: e.target.value })}
                    placeholder="e.g. Contact us"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Destination</Label>
                  <Tabs
                    value={item.source}
                    onValueChange={(value) => setSource(i, value)}
                    className="gap-3"
                  >
                    <TabsList className="grid h-9 w-full grid-cols-2">
                      <TabsTrigger value="site" className="gap-1.5 text-xs sm:text-sm">
                        <Link2 className="size-3.5" />
                        Site page
                      </TabsTrigger>
                      <TabsTrigger value="external" className="gap-1.5 text-xs sm:text-sm">
                        <Globe className="size-3.5" />
                        External URL
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="site" className="mt-0 space-y-2">
                      {loading ? (
                        <div className="rounded-lg border border-dashed border-border bg-muted px-3 py-6 text-center text-sm text-muted-foreground">
                          Loading sitemap…
                        </div>
                      ) : pickableEntries.length > 0 ? (
                        <>
                          <Select
                            value={item.nodeId || undefined}
                            onValueChange={(nodeId) => pickPage(i, nodeId)}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Choose a page from your sitemap" />
                            </SelectTrigger>
                            <SelectContent
                              position="popper"
                              className="max-h-64"
                              style={{ zIndex: ADMIN_Z.popover }}
                            >
                              {pickableEntries.map(({ node, depth }) => {
                                const typeLabel = nodeTypeLabel(node.type);
                                const path = navNodeHref(node, nodes);
                                return (
                                  <SelectItem key={node.id} value={node.id}>
                                    <span className="flex min-w-0 items-center gap-2">
                                      <span
                                        className="truncate"
                                        style={{ paddingLeft: depth * 12 }}
                                      >
                                        {node.title}
                                      </span>
                                      {typeLabel && (
                                        <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                                          {typeLabel}
                                        </span>
                                      )}
                                      <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">
                                        {path}
                                      </span>
                                    </span>
                                  </SelectItem>
                                );
                              })}
                            </SelectContent>
                          </Select>
                          {item.href && (
                            <p className="text-xs text-muted-foreground">
                              Links to{" "}
                              <code className="rounded bg-muted px-1 py-0.5 text-foreground">
                                {item.href}
                              </code>
                            </p>
                          )}
                        </>
                      ) : (
                        <div className="rounded-lg border border-dashed border-amber-200 bg-amber-50/50 px-4 py-5 text-center">
                          <p className="text-sm text-muted-foreground">No pages in your sitemap yet.</p>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="mt-3"
                            asChild
                          >
                            <Link href="/builder/sitemap">Open sitemap editor</Link>
                          </Button>
                        </div>
                      )}
                    </TabsContent>

                    <TabsContent value="external" className="mt-0 space-y-2">
                      <div className="relative">
                        <ExternalLink className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          value={item.href}
                          onChange={(e) =>
                            updateItem(i, { href: e.target.value, nodeId: "", source: "external" })
                          }
                          placeholder="https://example.com or /custom-path"
                          className="pl-9"
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Use a full URL for off-site links, or a path like{" "}
                        <code className="rounded bg-muted px-1 py-0.5">/donate</code> for custom
                        routes.
                      </p>
                    </TabsContent>
                  </Tabs>
                </div>
              </div>
            </div>
          ))}

          <Button
            type="button"
            variant="outline"
            onClick={addItem}
            className={cn("w-full border-dashed", items.length > 0 && "mt-1")}
          >
            <Plus className="size-4" />
            Add link
          </Button>
        </div>

        <div className="flex justify-end gap-2 border-t border-border bg-muted/50 px-5 py-4">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSave}>
            Save changes
          </Button>
        </div>
      </div>
    </div>
  );
}
