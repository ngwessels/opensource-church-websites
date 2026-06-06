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
import { GripVertical, Plus, Trash2, User } from "lucide-react";
import Image from "next/image";
import { useRef, useState } from "react";

import { MediaPicker } from "@/components/media/MediaPicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ADMIN_Z } from "@/lib/design/admin-tokens";
import { getFirebaseFirestore } from "@/lib/firebase/firestore";
import { uploadMediaFile } from "@/lib/media/upload";
import { createEmptyPerson, normalizePerson } from "@/lib/people/schema";
import { DEFAULT_MEDIA_FOLDERS } from "@/types/firestore";
import { cn } from "@/lib/utils";

const pickerZ = { zIndex: ADMIN_Z.popover };

/**
 * @param {Object} props
 * @param {import('@/lib/people/types').Person} person
 * @param {number} index
 * @param {(index: number, field: string, value: string) => void} onUpdate
 * @param {(index: number) => void} onRemove
 * @param {number} totalCount
 * @param {(index: number) => void} onBrowsePhoto
 * @param {(index: number) => void} onUploadPhoto
 * @param {boolean} uploading
 * @param {number} uploadProgress
 */
function SortablePersonCard({
  person,
  index,
  onUpdate,
  onRemove,
  totalCount,
  onBrowsePhoto,
  onUploadPhoto,
  uploading,
  uploadProgress,
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: person.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="rounded-lg border border-border bg-card shadow-sm"
    >
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
            Person {index + 1}
          </span>
        </div>
        {totalCount > 1 && (
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
        <div className="flex gap-4">
          <div className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-muted">
            {person.photoUrl ? (
              <Image
                src={person.photoUrl}
                alt=""
                fill
                className="object-cover"
                unoptimized
              />
            ) : (
              <User className="h-8 w-8 text-muted-foreground" />
            )}
          </div>
          <div className="flex min-w-0 flex-1 flex-col justify-center gap-2">
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onBrowsePhoto(index)}
              >
                Browse media
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onUploadPhoto(index)}
                disabled={uploading}
              >
                {uploading ? `Uploading ${uploadProgress}%` : "Upload photo"}
              </Button>
            </div>
            <Input
              value={person.photoUrl}
              onChange={(e) => onUpdate(index, "photoUrl", e.target.value)}
              placeholder="Photo URL (optional)"
              className="h-8 text-sm"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={`person-name-${person.id}`}>Name</Label>
          <Input
            id={`person-name-${person.id}`}
            value={person.name}
            onChange={(e) => onUpdate(index, "name", e.target.value)}
            placeholder="e.g. Fr. Michael Vuky"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={`person-role-${person.id}`}>Role / title</Label>
          <Input
            id={`person-role-${person.id}`}
            value={person.role}
            onChange={(e) => onUpdate(index, "role", e.target.value)}
            placeholder="e.g. Pastor"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor={`person-email-${person.id}`}>Email</Label>
            <Input
              id={`person-email-${person.id}`}
              type="email"
              value={person.email}
              onChange={(e) => onUpdate(index, "email", e.target.value)}
              placeholder="name@parish.org"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`person-phone-${person.id}`}>Phone</Label>
            <Input
              id={`person-phone-${person.id}`}
              type="tel"
              value={person.phone}
              onChange={(e) => onUpdate(index, "phone", e.target.value)}
              placeholder="e.g. (503) 555-1234"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * @param {Object} props
 * @param {import('@/lib/people/types').Person[]} props.people
 * @param {(people: import('@/lib/people/types').Person[]) => void} props.onChange
 */
export function PeopleListForm({ people, onChange }) {
  const normalized = people.map(normalizePerson);
  const [pickingIndex, setPickingIndex] = useState(null);
  const [uploadingIndex, setUploadingIndex] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const uploadRef = useRef(null);
  const uploadPersonIndexRef = useRef(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
  );

  const updatePerson = (index, field, value) => {
    onChange(
      normalized.map((person, i) => (i === index ? { ...person, [field]: value } : person)),
    );
  };

  const removePerson = (index) => {
    if (normalized.length <= 1) return;
    onChange(normalized.filter((_, i) => i !== index));
  };

  const addPerson = () => {
    onChange([...normalized, createEmptyPerson()]);
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = normalized.findIndex((p) => p.id === active.id);
    const newIndex = normalized.findIndex((p) => p.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    onChange(arrayMove(normalized, oldIndex, newIndex));
  };

  const applyPhotoUrl = (index, url) => {
    updatePerson(index, "photoUrl", url);
    setPickingIndex(null);
  };

  const handleUpload = async (e) => {
    const fileList = e.target.files;
    const index = uploadPersonIndexRef.current;
    if (!fileList?.length || index === null) return;

    setUploadingIndex(index);
    const db = getFirebaseFirestore();

    try {
      const record = await uploadMediaFile(
        db,
        fileList[0],
        DEFAULT_MEDIA_FOLDERS.pictures,
        setUploadProgress,
      );
      if (record.downloadUrl) {
        applyPhotoUrl(index, record.downloadUrl);
      }
    } finally {
      setUploadingIndex(null);
      setUploadProgress(0);
      uploadPersonIndexRef.current = null;
      if (uploadRef.current) uploadRef.current.value = "";
    }
  };

  const triggerUpload = (index) => {
    uploadPersonIndexRef.current = index;
    uploadRef.current?.click();
  };

  if (pickingIndex !== null) {
    return (
      <div className="fixed inset-0 flex flex-col bg-card" style={pickerZ}>
        <MediaPicker
          fullscreen
          title="Choose photo"
          onSelect={(file) => {
            if (file.downloadUrl) {
              applyPhotoUrl(pickingIndex, file.downloadUrl);
            }
          }}
          onCancel={() => setPickingIndex(null)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <input
        ref={uploadRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleUpload}
      />

      {normalized.length === 0 && (
        <p className="text-sm text-muted-foreground">No staff members yet. Add one below.</p>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext
          items={normalized.map((p) => p.id)}
          strategy={verticalListSortingStrategy}
        >
          {normalized.map((person, i) => (
            <SortablePersonCard
              key={person.id}
              person={person}
              index={i}
              totalCount={normalized.length}
              onUpdate={updatePerson}
              onRemove={removePerson}
              onBrowsePhoto={setPickingIndex}
              onUploadPhoto={triggerUpload}
              uploading={uploadingIndex === i}
              uploadProgress={uploadProgress}
            />
          ))}
        </SortableContext>
      </DndContext>

      <Button
        type="button"
        variant="outline"
        onClick={addPerson}
        className={cn("w-full border-dashed", normalized.length > 0 && "mt-1")}
      >
        <Plus className="size-4" />
        Add person
      </Button>
    </div>
  );
}
