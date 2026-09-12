"use client";

import Image from "@tiptap/extension-image";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  Bold,
  Heading2,
  ImagePlus,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Underline as UnderlineIcon,
} from "lucide-react";
import { useEffect, useState } from "react";

import { MediaPicker } from "@/components/media/MediaPicker";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const editorClass =
  "prose prose-zinc max-w-none prose-img:rounded-md prose-a:text-blue-700 min-h-[180px] px-3 py-2 outline-none";

/**
 * Rich-text body for list email. Images are inserted by URL from the media
 * library: mail clients load them over https, so nothing has to be embedded.
 *
 * @param {{ value: string, onChange: (html: string) => void, placeholder?: string }} props
 */
export function RichEmailEditor({ value, onChange, placeholder = "Write your message…" }) {
  const [pickingImage, setPickingImage] = useState(false);
  const editor = useEditor({
    extensions: [StarterKit, Image.configure({ HTMLAttributes: { style: "max-width:100%;height:auto;" } })],
    content: value || "<p></p>",
    immediatelyRender: false,
    editorProps: { attributes: { class: editorClass, "data-placeholder": placeholder } },
    onUpdate: ({ editor: instance }) => onChange(instance.getHTML()),
  });

  useEffect(() => {
    if (!editor) return;
    // Only reset when the parent replaced the body (e.g. after a send), never
    // while the admin is typing.
    if (value !== editor.getHTML()) {
      editor.commands.setContent(value || "<p></p>", { emitUpdate: false });
    }
  }, [editor, value]);

  if (!editor) {
    return <div className="min-h-[220px] rounded-md border border-input bg-background" />;
  }

  const addLink = () => {
    const previous = editor.getAttributes("link").href || "";
    const href = window.prompt("Link URL", previous);
    if (href === null) return;
    if (!href.trim()) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: href.trim() }).run();
  };

  return (
    <div className="rounded-md border border-input bg-background">
      <div className="flex flex-wrap items-center gap-1 border-b border-border px-2 py-1.5">
        <ToolbarButton
          label="Bold"
          active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Italic"
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <Italic className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Underline"
          active={editor.isActive("underline")}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        >
          <UnderlineIcon className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Heading"
          active={editor.isActive("heading", { level: 2 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        >
          <Heading2 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Bullet list"
          active={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <List className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Numbered list"
          active={editor.isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton label="Link" active={editor.isActive("link")} onClick={addLink}>
          <LinkIcon className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton label="Insert photo" onClick={() => setPickingImage(true)}>
          <ImagePlus className="h-4 w-4" />
        </ToolbarButton>
      </div>

      <EditorContent editor={editor} />

      <Dialog open={pickingImage} onOpenChange={setPickingImage}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Insert a photo</DialogTitle>
          </DialogHeader>
          <div className="min-h-[380px]">
            <MediaPicker
              title="Choose a photo"
              mediaFilter="images"
              onSelect={(file) => {
                if (file?.downloadUrl) {
                  editor
                    .chain()
                    .focus()
                    .setImage({ src: file.downloadUrl, alt: file.alt || file.name || "" })
                    .run();
                }
                setPickingImage(false);
              }}
              onCancel={() => setPickingImage(false)}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/**
 * @param {{
 *   label: string,
 *   active?: boolean,
 *   onClick: () => void,
 *   children: import('react').ReactNode,
 * }} props
 */
function ToolbarButton({ label, active = false, onClick, children }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={label}
      title={label}
      aria-pressed={active}
      className={cn("h-8 w-8", active && "bg-muted text-foreground")}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}
