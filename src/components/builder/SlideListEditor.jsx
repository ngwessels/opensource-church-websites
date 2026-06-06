"use client";

import Image from "next/image";
import { useRef, useState } from "react";

import { MediaPicker } from "@/components/media/MediaPicker";
import { Button } from "@/components/ui/button";
import { getFirebaseFirestore } from "@/lib/firebase/firestore";
import { uploadMediaFile } from "@/lib/media/upload";
import { DEFAULT_MEDIA_FOLDERS } from "@/types/firestore";

function filenameToAlt(name) {
  return name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim();
}

export function SlideListEditor({ slides: initialSlides = [], onChange, showTitle = false, title: initialTitle = "" }) {
  const [slides, setSlides] = useState(
    initialSlides.length ? initialSlides : [{ src: "", alt: "", caption: "" }],
  );
  const [title, setTitle] = useState(initialTitle);
  const [pickingIndex, setPickingIndex] = useState(null);
  const [uploadingIndex, setUploadingIndex] = useState(null);
  const [progress, setProgress] = useState(0);
  const uploadRef = useRef(null);
  const uploadSlideIndexRef = useRef(null);

  const updateSlide = (index, field, value) => {
    setSlides((prev) => {
      const next = prev.map((s, i) => (i === index ? { ...s, [field]: value } : s));
      onChange?.({ slides: next, title });
      return next;
    });
  };

  const applyMediaFile = (index, file) => {
    setSlides((prev) => {
      const slide = prev[index];
      const updates = {};
      if (file.downloadUrl) updates.src = file.downloadUrl;
      if (file.name && !slide.alt?.trim()) updates.alt = filenameToAlt(file.name);
      const next = prev.map((s, i) => (i === index ? { ...s, ...updates } : s));
      onChange?.({ slides: next, title });
      return next;
    });
    setPickingIndex(null);
  };

  const handleUpload = async (e) => {
    const fileList = e.target.files;
    const index = uploadSlideIndexRef.current;
    if (!fileList?.length || index === null) return;

    setUploadingIndex(index);
    const db = getFirebaseFirestore();

    try {
      const record = await uploadMediaFile(
        db,
        fileList[0],
        DEFAULT_MEDIA_FOLDERS.pictures,
        setProgress,
      );
      applyMediaFile(index, record);
    } finally {
      setUploadingIndex(null);
      setProgress(0);
      uploadSlideIndexRef.current = null;
      if (uploadRef.current) uploadRef.current.value = "";
    }
  };

  const triggerUpload = (index) => {
    uploadSlideIndexRef.current = index;
    uploadRef.current?.click();
  };

  const updateTitle = (value) => {
    setTitle(value);
    onChange?.({ slides, title: value });
  };

  const addSlide = () => {
    setSlides((prev) => {
      const next = [...prev, { src: "", alt: "", caption: "" }];
      onChange?.({ slides: next, title });
      return next;
    });
  };

  const removeSlide = (index) => {
    setSlides((prev) => {
      const next = prev.length <= 1 ? prev : prev.filter((_, i) => i !== index);
      onChange?.({ slides: next, title });
      return next;
    });
  };

  if (pickingIndex !== null) {
    return (
      <div className="flex min-h-[320px] flex-col">
        <MediaPicker
          onSelect={(file) => applyMediaFile(pickingIndex, file)}
          onCancel={() => setPickingIndex(null)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <input
        ref={uploadRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleUpload}
      />
      {showTitle && (
        <input
          value={title}
          onChange={(e) => updateTitle(e.target.value)}
          placeholder="Section title (optional)"
          className="w-full rounded border px-3 py-2 text-sm"
        />
      )}
      {slides.map((slide, i) => (
        <div key={i} className="space-y-2 rounded border border-border p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Slide {i + 1}</span>
            {slides.length > 1 && (
              <button
                type="button"
                onClick={() => removeSlide(i)}
                className="text-xs text-red-600 hover:underline"
              >
                Remove
              </button>
            )}
          </div>
          {slide.src && (
            <div className="overflow-hidden rounded border border-border">
              <Image
                src={slide.src}
                alt={slide.alt || `Slide ${i + 1}`}
                width={400}
                height={200}
                className="h-32 w-full object-cover"
                unoptimized
              />
            </div>
          )}
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setPickingIndex(i)}>
              Browse media
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => triggerUpload(i)}
              disabled={uploadingIndex === i}
            >
              {uploadingIndex === i ? `Uploading ${progress}%` : "Upload image"}
            </Button>
          </div>
          <input
            value={slide.src}
            onChange={(e) => updateSlide(i, "src", e.target.value)}
            placeholder="Image URL"
            className="w-full rounded border px-3 py-2 text-sm"
          />
          <input
            value={slide.alt || ""}
            onChange={(e) => updateSlide(i, "alt", e.target.value)}
            placeholder="Alt text"
            className="w-full rounded border px-3 py-2 text-sm"
          />
          <input
            value={slide.caption || ""}
            onChange={(e) => updateSlide(i, "caption", e.target.value)}
            placeholder="Caption"
            className="w-full rounded border px-3 py-2 text-sm"
          />
        </div>
      ))}
      <button type="button" onClick={addSlide} className="text-sm text-primary hover:underline">
        + Add slide
      </button>
    </div>
  );
}
