"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useCallback, useEffect, useRef, useState } from "react";

const proseClass =
  "prose prose-zinc max-w-none prose-headings:font-semibold prose-a:text-[var(--site-primary)]";

export function TextModule({ module, editing = false, onSave }) {
  const { title: configTitle, html: configHtml } = module.config || {};
  const [title, setTitle] = useState(configTitle || "");
  const saveTimeoutRef = useRef(null);
  const lastSavedRef = useRef({ title: configTitle || "", html: configHtml || "" });
  const titleRef = useRef(title);
  const titleInputRef = useRef(null);
  const onSaveRef = useRef(onSave);

  const adjustTitleHeight = useCallback(() => {
    const el = titleInputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, []);

  useEffect(() => {
    titleRef.current = title;
  }, [title]);

  useEffect(() => {
    onSaveRef.current = onSave;
  }, [onSave]);

  const persist = useCallback((newTitle, newHtml) => {
    const save = onSaveRef.current;
    if (!save) return;
    const payload = { title: newTitle, html: newHtml };
    if (
      payload.title === lastSavedRef.current.title &&
      payload.html === lastSavedRef.current.html
    ) {
      return;
    }
    lastSavedRef.current = payload;
    save(payload);
  }, []);

  const scheduleSave = useCallback(
    (newTitle, newHtml) => {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => persist(newTitle, newHtml), 600);
    },
    [persist],
  );

  const editor = useEditor({
    extensions: [StarterKit],
    content: configHtml || "<p></p>",
    immediatelyRender: false,
    editable: editing,
    editorProps: {
      attributes: {
        class: `${proseClass} outline-none min-h-[1.5em] focus:outline-none`,
      },
    },
    onUpdate: ({ editor: ed }) => {
      if (!editing || !onSaveRef.current) return;
      scheduleSave(titleRef.current, ed.getHTML());
    },
  });

  useEffect(() => {
    setTitle(configTitle || "");
    lastSavedRef.current = { title: configTitle || "", html: configHtml || "" };
    if (editor) {
      editor.commands.setContent(configHtml || "<p></p>");
    }
  }, [module.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    editor?.setEditable(editing);
  }, [editor, editing]);

  useEffect(() => () => clearTimeout(saveTimeoutRef.current), []);

  useEffect(() => {
    adjustTitleHeight();
  }, [title, adjustTitleHeight]);

  const handleTitleChange = (e) => {
    const newTitle = e.target.value;
    setTitle(newTitle);
    if (editing && onSaveRef.current) {
      scheduleSave(newTitle, editor?.getHTML() || "");
    }
  };

  const handleTitleKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
    }
  };

  const handleTitleBlur = () => {
    if (editing && onSaveRef.current) {
      clearTimeout(saveTimeoutRef.current);
      persist(title, editor?.getHTML() || "");
    }
  };

  const handleEditorBlur = useCallback(() => {
    if (editing && onSaveRef.current) {
      clearTimeout(saveTimeoutRef.current);
      persist(titleRef.current, editor?.getHTML() || "");
    }
  }, [editing, editor]);

  useEffect(() => {
    if (!editor || !editing) return;
    editor.on("blur", handleEditorBlur);
    return () => editor.off("blur", handleEditorBlur);
  }, [editor, editing, handleEditorBlur]);

  if (!editing) {
    return (
      <section>
        {configTitle && (
          <h2 className="mb-4 break-words border-b-2 border-[var(--site-primary)] pb-2 text-xl font-semibold text-zinc-900">
            {configTitle}
          </h2>
        )}
        {configHtml && (
          <div className={proseClass} dangerouslySetInnerHTML={{ __html: configHtml }} />
        )}
      </section>
    );
  }

  return (
    <section>
      <textarea
        ref={titleInputRef}
        rows={1}
        value={title}
        onChange={handleTitleChange}
        onBlur={handleTitleBlur}
        onKeyDown={handleTitleKeyDown}
        placeholder="Section title"
        className="mb-4 w-full resize-none overflow-hidden break-words border-b-2 border-[var(--site-primary)] bg-transparent pb-2 text-xl font-semibold leading-snug text-zinc-900 outline-none placeholder:text-zinc-400"
      />
      <EditorContent editor={editor} />
    </section>
  );
}
