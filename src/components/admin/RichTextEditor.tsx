// ============================================================================
// File: src/components/admin/RichTextEditor.tsx
// Purpose: Lightweight rich-text editor built on a contentEditable div +
//          document.execCommand (deprecated but still works in every browser).
//          Outputs HTML, accepts HTML as its initial value, and calls
//          onChange(html) on every input. No external npm dependency — keeps
//          the bundle tiny while still giving admins Bold / Italic / Underline,
//          bullet + numbered lists, H2/H3 headings, links, and a clear-formatting
//          button. Toolbar uses lucide-react icons + shadcn Button for a native
//          look that matches the rest of the admin UI.
// ============================================================================

"use client";

import { useEffect, useRef, useId } from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  Heading2,
  Heading3,
  Link as LinkIcon,
  Eraser,
} from "lucide-react";

interface RichTextEditorProps {
  /** Initial HTML content. */
  value: string;
  /** Called with the latest HTML on every input/blur. */
  onChange: (html: string) => void;
  /** Optional placeholder text shown when the editor is empty. */
  placeholder?: string;
  /** Optional id for the contentEditable div (useful for labels). */
  id?: string;
  /** Optional className merged into the wrapper. */
  className?: string;
}

/**
 * Static toolbar definition. Lives outside the component so it is created
 * once — the click handlers are bound to the live `editorRef` / `onChange`
 * via the `useRichTextToolbar` hook below.
 */
const TOOL_DEFS: Array<{ key: string; icon: typeof Bold; label: string; cmd: string; arg?: string; kind: "exec" | "link" | "clear" }> = [
  { key: "bold", icon: Bold, label: "Bold", cmd: "bold", kind: "exec" },
  { key: "italic", icon: Italic, label: "Italic", cmd: "italic", kind: "exec" },
  { key: "underline", icon: Underline, label: "Underline", cmd: "underline", kind: "exec" },
  { key: "h2", icon: Heading2, label: "Heading 2", cmd: "formatBlock", arg: "<h2>", kind: "exec" },
  { key: "h3", icon: Heading3, label: "Heading 3", cmd: "formatBlock", arg: "<h3>", kind: "exec" },
  { key: "ul", icon: List, label: "Bullet List", cmd: "insertUnorderedList", kind: "exec" },
  { key: "ol", icon: ListOrdered, label: "Numbered List", cmd: "insertOrderedList", kind: "exec" },
  { key: "link", icon: LinkIcon, label: "Insert Link", cmd: "createLink", kind: "link" },
  { key: "clear", icon: Eraser, label: "Clear Formatting", cmd: "removeFormat", kind: "clear" },
];

export function RichTextEditor({
  value,
  onChange,
  placeholder = "Write something...",
  id,
  className,
}: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const reactId = useId();
  const editorId = id ?? `rte-${reactId}`;

  // Keep the onChange ref in a ref so the input handler doesn't need to be
  // re-bound when the parent passes a new closure (it always does). This
  // avoids stale closures without putting `onChange` in any dep array.
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });

  // Initialise / re-sync the contentEditable's HTML when the parent pushes a
  // genuinely different value (e.g. after load or a reset). We do NOT re-sync
  // on every render — that would reset the caret every keystroke.
  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    if (value !== el.innerHTML) {
      el.innerHTML = value ?? "";
    }
  }, [value]);

  // Read the current HTML from the contentEditable and forward to parent.
  function emitChange() {
    if (editorRef.current) {
      onChangeRef.current(editorRef.current.innerHTML);
    }
  }

  // Run a document.execCommand, refocus, and emit a change so the parent
  // stays in sync. execCommand is deprecated but still works in every
  // major browser as of 2024 — there's no native replacement that doesn't
  // require shipping a 100KB+ editor library.
  function run(command: string, arg?: string) {
    editorRef.current?.focus();
    document.execCommand(command, false, arg);
    emitChange();
  }

  function onLink() {
    const url = window.prompt("Enter URL");
    if (!url) return;
    // Basic protocol fixup so users can type "example.com" without https://
    const normalized = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    run("createLink", normalized);
  }

  function onClearFormatting() {
    // Remove bold/italic/underline, links, headings → plain paragraph text.
    run("removeFormat");
    // Also strip heading/list semantics for a true "clear".
    run("formatBlock", "<p>");
  }

  // Click handler dispatcher — resolves each tool to its action.
  function handleToolClick(kind: "exec" | "link" | "clear", cmd: string, arg?: string) {
    if (kind === "link") onLink();
    else if (kind === "clear") onClearFormatting();
    else run(cmd, arg);
  }

  return (
    <div className={`rounded-md border bg-background ${className ?? ""}`}>
      {/* Toolbar */}
      <div
        role="toolbar"
        aria-label="Text formatting"
        className="flex flex-wrap items-center gap-1 border-b bg-muted/30 p-1.5"
      >
        {TOOL_DEFS.map((t, i) => {
          const Icon = t.icon;
          // Show a subtle separator between the text-style buttons and the
          // list/heading/link buttons to visually group them.
          const showSepBefore =
            i > 0 &&
            (t.icon === Heading2 ||
              t.icon === List ||
              t.icon === LinkIcon ||
              t.icon === Eraser);
          return (
            <span key={t.key} className="flex items-center">
              {showSepBefore && <Separator orientation="vertical" className="mx-1 h-5" />}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8"
                aria-label={t.label}
                title={t.label}
                // Prevent the button from stealing focus from the editor
                // (which would lose the selection the command acts on).
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleToolClick(t.kind, t.cmd, t.arg)}
              >
                <Icon className="size-4" />
              </Button>
            </span>
          );
        })}
      </div>

      {/* Editable surface */}
      <div
        id={editorId}
        ref={editorRef}
        role="textbox"
        aria-multiline="true"
        contentEditable
        suppressContentEditableWarning
        onInput={emitChange}
        onBlur={emitChange}
        data-placeholder={placeholder}
        className="prose prose-sm max-w-none min-h-[200px] px-3 py-2 text-sm leading-relaxed outline-none
          focus:ring-2 focus:ring-ring focus:ring-inset
          [&:empty:before]:content-[attr(data-placeholder)]
          [&:empty:before]:text-muted-foreground/60
          [&_ul]:list-disc [&_ul]:pl-5
          [&_ol]:list-decimal [&_ol]:pl-5
          [&_h2]:mt-3 [&_h2]:mb-1.5 [&_h2]:text-lg [&_h2]:font-semibold
          [&_h3]:mt-2 [&_h3]:mb-1 [&_h3]:text-base [&_h3]:font-semibold
          [&_a]:text-primary [&_a]:underline"
      />
    </div>
  );
}
