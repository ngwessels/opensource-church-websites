"use client";

import {
  closestCenter,
  DndContext,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { doc, onSnapshot } from "firebase/firestore";
import { GripVertical, Plus, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { createEmptyNote, normalizeAdminDocumentation } from "@/lib/admin/documentation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { useUserProfile } from "@/hooks/useUserProfile";
import { getFirebaseFirestore } from "@/lib/firebase/firestore";
import { auditedSetDoc, buildClientAuditActor } from "@/lib/firestore/audited-mutation";
import { ADMIN_DOCUMENTATION_ID, COLLECTIONS } from "@/lib/firestore/paths";

const textareaClassName =
  "flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none";

/**
 * @param {object} props
 * @param {import("@/types/firestore").AdminDocumentationNote} props.note
 * @param {number} props.index
 * @param {(index: number, field: "title" | "body", value: string) => void} props.onUpdate
 * @param {(index: number) => void} props.onRemove
 * @param {number} props.totalCount
 */
function SortableNoteCard({ note, index, onUpdate, onRemove, totalCount }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: note.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="rounded-lg border border-border bg-card shadow-sm">
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="flex h-7 w-7 cursor-grab items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground active:cursor-grabbing"
            {...attributes}
            {...listeners}
            aria-label="Drag to reorder"
          >
            <GripVertical className="size-4" />
          </button>
          <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Note {index + 1}
          </span>
        </div>
        {totalCount > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={() => onRemove(index)}
            className="h-7 gap-1 text-red-600 hover:bg-red-50 hover:text-red-700"
          >
            <Trash2 className="size-3.5" />
            Remove
          </Button>
        )}
      </div>

      <div className="space-y-4 p-4">
        <div className="space-y-1.5">
          <Label htmlFor={`note-title-${note.id}`}>Title</Label>
          <Input
            id={`note-title-${note.id}`}
            value={note.title}
            onChange={(e) => onUpdate(index, "title", e.target.value)}
            placeholder="e.g. Domain registrar"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`note-body-${note.id}`}>Details</Label>
          <textarea
            id={`note-body-${note.id}`}
            value={note.body}
            onChange={(e) => onUpdate(index, "body", e.target.value)}
            rows={4}
            placeholder="e.g. The domain is hosted on Network Solutions under the parish account."
            className={textareaClassName}
          />
        </div>
      </div>
    </div>
  );
}

export function AdminDocumentation() {
  const { user } = useAuth();
  const { profile } = useUserProfile();
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [dirty, setDirty] = useState(false);
  const dirtyRef = useRef(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
  );

  useEffect(() => {
    dirtyRef.current = dirty;
  }, [dirty]);

  useEffect(() => {
    const db = getFirebaseFirestore();
    const ref = doc(db, COLLECTIONS.site, ADMIN_DOCUMENTATION_ID);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (!dirtyRef.current) {
          const data = snap.exists() ? normalizeAdminDocumentation(snap.data()) : { notes: [] };
          setNotes(data.notes);
        }
        setLoading(false);
      },
      (err) => {
        setError(err instanceof Error ? err.message : "Failed to load documentation.");
        setLoading(false);
      },
    );
    return () => unsub();
  }, []);

  const updateNote = (index, field, value) => {
    setDirty(true);
    setNotes((current) =>
      current.map((note, i) => (i === index ? { ...note, [field]: value } : note)),
    );
  };

  const removeNote = (index) => {
    setDirty(true);
    setNotes((current) => current.filter((_, i) => i !== index));
  };

  const addNote = () => {
    setDirty(true);
    setNotes((current) => [...current, createEmptyNote({ order: current.length })]);
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = notes.findIndex((note) => note.id === active.id);
    const newIndex = notes.findIndex((note) => note.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    setDirty(true);
    setNotes(arrayMove(notes, oldIndex, newIndex));
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const db = getFirebaseFirestore();
      const timestamp = new Date().toISOString();
      const updatedBy = user
        ? {
            uid: user.uid,
            ...(user.email ? { email: user.email } : {}),
            source: "ui",
          }
        : { source: "ui" };

      const normalized = normalizeAdminDocumentation({
        notes: notes.map((note, index) => ({
          ...note,
          order: index,
          updatedAt: timestamp,
          updatedBy,
        })),
        updatedAt: timestamp,
      });

      const docRef = doc(db, COLLECTIONS.site, ADMIN_DOCUMENTATION_ID);
      const actor = buildClientAuditActor(user, profile);
      if (actor) {
        await auditedSetDoc(docRef, normalized, {
          actor,
          action: "update",
          resource: { type: "admin_documentation", path: "site/adminDocumentation" },
          summary: "Saved admin documentation",
          context: { builderPath: "/builder/admin", section: "documentation" },
        });
      } else {
        const { setDoc } = await import("firebase/firestore");
        await setDoc(docRef, normalized);
      }
      setNotes(normalized.notes);
      setDirty(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save documentation.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl text-sm text-muted-foreground">Loading documentation…</div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Documentation</CardTitle>
          <p className="text-sm text-muted-foreground">
            Shared notes for admins — domain registrar, hosting accounts, where credentials are kept,
            and other operational details.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {notes.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No notes yet. Add one to document how this site is hosted and managed.
            </p>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={notes.map((note) => note.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-3">
                  {notes.map((note, index) => (
                    <SortableNoteCard
                      key={note.id}
                      note={note}
                      index={index}
                      onUpdate={updateNote}
                      onRemove={removeNote}
                      totalCount={notes.length}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={addNote}>
              <Plus className="mr-1.5 size-4" />
              Add note
            </Button>
            <Button type="button" size="sm" onClick={handleSave} disabled={saving || !dirty}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </CardContent>
      </Card>
    </div>
  );
}
