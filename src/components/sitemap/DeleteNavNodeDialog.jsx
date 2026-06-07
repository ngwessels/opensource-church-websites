"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { NAV_TYPE_META } from "./nav-type-meta";

function countDescendantNodes(nodes, nodeId) {
  return nodes
    .filter((n) => n.parentId === nodeId)
    .reduce((sum, child) => sum + 1 + countDescendantNodes(nodes, child.id), 0);
}

export function DeleteNavNodeDialog({ node, nodes, open, onOpenChange, onConfirm }) {
  if (!node) return null;

  const meta = NAV_TYPE_META[node.type] || NAV_TYPE_META.page;
  const descendantCount = countDescendantNodes(nodes, node.id);
  const typeLabel = meta.label === "Group" ? "link group" : meta.label.toLowerCase();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Remove “{node.title}”?</DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>
                This {typeLabel} will be removed from the site map
                {descendantCount > 0
                  ? `, along with ${descendantCount} nested ${descendantCount === 1 ? "item" : "items"}.`
                  : "."}
              </p>
              <p>Click Save changes on the sitemap editor to apply this permanently.</p>
            </div>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="border-t-0 pt-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" variant="destructive" onClick={onConfirm}>
            Remove
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
