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
import { MODULE_LABELS } from "@/lib/design/admin-tokens";

export function RemoveModuleDialog({ module, open, onOpenChange, onConfirm, removing }) {
  const label = module ? MODULE_LABELS[module.type] || module.type : "module";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" showCloseButton={!removing}>
        <DialogHeader>
          <DialogTitle>Remove {label}?</DialogTitle>
          <DialogDescription>
            This module will be removed from the page. You can undo by reverting your draft before
            publishing.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="border-t-0 pt-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={removing}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={onConfirm}
            disabled={removing}
          >
            {removing ? "Removing…" : "Remove"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
