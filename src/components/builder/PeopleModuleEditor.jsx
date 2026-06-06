"use client";

import { Users } from "lucide-react";
import { useState } from "react";

import { PeopleListForm } from "@/components/people/PeopleListForm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ADMIN_Z } from "@/lib/design/admin-tokens";
import { normalizePeopleConfig } from "@/lib/people/schema";

const overlayZ = { zIndex: ADMIN_Z.overlay };

/**
 * @param {Object} props
 * @param {{ config?: import('@/lib/people/types').PeopleModuleConfig }} props.module
 * @param {(config: Record<string, unknown>) => void} props.onSave
 * @param {() => void} props.onClose
 */
export function PeopleModuleEditor({ module, onSave, onClose }) {
  const initial = normalizePeopleConfig(module?.config);

  const [title, setTitle] = useState(initial.title || "Staff");
  const [people, setPeople] = useState(initial.people || []);

  const handleSave = () => {
    onSave(
      normalizePeopleConfig({ title, people }, { filterEmpty: true }),
    );
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/50 p-4" style={overlayZ}>
      <div className="flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-xl bg-card shadow-2xl">
        <div className="flex items-start gap-3 border-b border-border bg-muted/80 px-5 py-4">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-red-600 text-white shadow-sm">
            <Users className="size-5" />
          </div>
          <div className="min-w-0 flex-1 space-y-3">
            <div>
              <h2 className="text-base font-semibold text-foreground">Edit staff</h2>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Add parish staff with name, role, contact info, and photo.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="people-section-title" className="text-muted-foreground">
                Section title
              </Label>
              <Input
                id="people-section-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Our Staff"
                className="h-9 bg-card"
              />
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-5">
          <PeopleListForm people={people} onChange={setPeople} />
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
