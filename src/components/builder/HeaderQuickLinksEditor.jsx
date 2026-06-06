"use client";

import { ExternalLink, Globe, Link2, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";

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
import { useNavNodes } from "@/hooks/useNavNodes";
import { generateId, resolveNavHref } from "@/lib/sitemap/tree";

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

function createDraftItem() {
  return {
    id: `new_${generateId()}`,
    title: "",
    source: "site",
    targetNodeId: "",
    externalUrl: "",
  };
}

function nodeTypeLabel(type) {
  if (type === "secure_page") return "Secure";
  if (type === "link") return "External";
  return null;
}

export function HeaderQuickLinksEditor({ items, onChange }) {
  const { nodes, tree, loading } = useNavNodes();
  const pickableEntries = useMemo(() => flattenPickableTree(tree), [tree]);

  const updateItem = (index, patch) => {
    onChange(items.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  };

  const setSource = (index, source) => {
    onChange(
      items.map((item, i) => {
        if (i !== index) return item;
        if (source === "site") {
          return { ...item, source, targetNodeId: "", externalUrl: "" };
        }
        return { ...item, source, targetNodeId: "" };
      }),
    );
  };

  const pickPage = (index, nodeId) => {
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return;
    updateItem(index, {
      targetNodeId: nodeId,
      source: "site",
      title: items[index].title.trim() ? items[index].title : node.title || "",
    });
  };

  const removeItem = (index) => {
    onChange(items.filter((_, i) => i !== index));
  };

  const addItem = () => {
    onChange([...items, createDraftItem()]);
  };

  return (
    <div className="space-y-3 border-t pt-4">
      <div>
        <h4 className="text-sm font-semibold">Quick links</h4>
        <p className="mt-1 text-xs text-muted-foreground">
          Short links shown at the top of the header, like Contact Us or Our School.
        </p>
      </div>

      {items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-muted/40 px-4 py-5 text-center">
          <p className="text-sm text-muted-foreground">No quick links yet.</p>
          <Button type="button" variant="outline" size="sm" className="mt-3" onClick={addItem}>
            <Plus className="size-4" />
            Add link
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item, i) => (
            <div key={item.id} className="rounded-lg border border-border bg-card shadow-sm">
              <div className="flex items-center justify-between border-b border-border px-3 py-2">
                <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  Link {i + 1}
                </span>
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
              </div>

              <div className="space-y-3 p-3">
                <div className="space-y-1.5">
                  <Label htmlFor={`quick-link-label-${i}`}>Label</Label>
                  <Input
                    id={`quick-link-label-${i}`}
                    value={item.title}
                    onChange={(e) => updateItem(i, { title: e.target.value })}
                    placeholder="e.g. Contact Us"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Destination</Label>
                  <Tabs value={item.source} onValueChange={(value) => setSource(i, value)}>
                    <TabsList className="grid h-9 w-full grid-cols-2">
                      <TabsTrigger value="site" className="gap-1.5 text-xs">
                        <Link2 className="size-3.5" />
                        Site page
                      </TabsTrigger>
                      <TabsTrigger value="external" className="gap-1.5 text-xs">
                        <Globe className="size-3.5" />
                        External URL
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="site" className="mt-2 space-y-2">
                      {loading ? (
                        <p className="text-sm text-muted-foreground">Loading sitemap…</p>
                      ) : pickableEntries.length > 0 ? (
                        <>
                          <Select
                            value={item.targetNodeId || undefined}
                            onValueChange={(nodeId) => pickPage(i, nodeId)}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Choose a page" />
                            </SelectTrigger>
                            <SelectContent position="popper" className="max-h-64">
                              {pickableEntries.map(({ node, depth }) => {
                                const typeLabel = nodeTypeLabel(node.type);
                                const path = resolveNavHref(nodes, node);
                                return (
                                  <SelectItem key={node.id} value={node.id}>
                                    <span className="flex min-w-0 items-center gap-2">
                                      <span className="truncate" style={{ paddingLeft: depth * 12 }}>
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
                          {item.targetNodeId && (
                            <p className="text-xs text-muted-foreground">
                              Links to{" "}
                              <code className="rounded bg-muted px-1 py-0.5">
                                {resolveNavHref(
                                  nodes,
                                  nodes.find((n) => n.id === item.targetNodeId),
                                )}
                              </code>
                            </p>
                          )}
                        </>
                      ) : (
                        <div className="rounded-lg border border-dashed border-amber-200 bg-amber-50/50 px-3 py-4 text-center">
                          <p className="text-sm text-muted-foreground">No pages in your sitemap yet.</p>
                          <Button type="button" variant="outline" size="sm" className="mt-2" asChild>
                            <Link href="/builder/sitemap">Open sitemap editor</Link>
                          </Button>
                        </div>
                      )}
                    </TabsContent>

                    <TabsContent value="external" className="mt-2 space-y-2">
                      <div className="relative">
                        <ExternalLink className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          value={item.externalUrl || ""}
                          onChange={(e) => updateItem(i, { externalUrl: e.target.value, source: "external" })}
                          placeholder="https://example.com or /staff"
                          className="pl-9"
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Full URLs open in a new tab. Site paths like <code className="rounded bg-muted px-1">/staff</code>{" "}
                        stay on this site.
                      </p>
                    </TabsContent>
                  </Tabs>
                </div>
              </div>
            </div>
          ))}

          <Button type="button" variant="outline" onClick={addItem} className="w-full border-dashed">
            <Plus className="size-4" />
            Add link
          </Button>
        </div>
      )}
    </div>
  );
}
