"use client";

import { AnimatePresence, motion } from "motion/react";
import { useRef, useState } from "react";
import { MAX_UPLOAD_MB, type ScanError } from "@/lib/errors";
import { ErrorNotice } from "./ErrorNotice";
import { CloudUploadIcon, DocIcon, UploadIcon } from "./Icons";

interface Props {
  onFile: (file: File) => void;
  onSample: () => void;
  disabled?: boolean;
  /** True while the sample PDF is being fetched. */
  sampleBusy?: boolean;
  /** The last scan or sample error, shown inside the card. */
  error?: ScanError | null;
  /** Offered after a timeout: keep waiting on the same scan. */
  onResume?: () => void;
}

type Drag = "none" | "pdf" | "other";

/** Browsers expose the dragged file's type during dragover (Safari may leave it blank). */
function dragKind(e: React.DragEvent): Drag {
  const item = e.dataTransfer.items?.[0];
  if (!item || item.kind !== "file") return "other";
  return item.type === "" || item.type === "application/pdf" ? "pdf" : "other";
}

const swap = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -6 },
  transition: { duration: 0.18 },
};

export function UploadZone({ onFile, onSample, disabled, sampleBusy, error, onResume }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const depth = useRef(0);
  const [drag, setDrag] = useState<Drag>("none");

  function pick(files: FileList | null) {
    const file = files?.[0];
    if (file) onFile(file);
    // Allow re-selecting the same file after an error.
    if (inputRef.current) inputRef.current.value = "";
  }

  const heading =
    drag === "pdf"
      ? "Drop it to start the scan"
      : drag === "other"
        ? "Only PDF files can be scanned"
        : "Drop your lease or contract PDF here";

  return (
    <section id="analyze" className="lp-upload" aria-labelledby="upload-title">
      <div
        className={`lp-drop${drag !== "none" ? ` lp-drop--${drag}` : ""}${error ? " lp-drop--error" : ""}`}
        // enter/leave fire for every child, so count depth to know when the drag really left
        onDragEnter={(e) => {
          e.preventDefault();
          depth.current += 1;
          if (!disabled) setDrag(dragKind(e));
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = disabled ? "none" : "copy";
        }}
        onDragLeave={() => {
          depth.current = Math.max(0, depth.current - 1);
          if (depth.current === 0) setDrag("none");
        }}
        onDrop={(e) => {
          e.preventDefault();
          depth.current = 0;
          setDrag("none");
          // non-PDFs still go through onFile so validation shows its usual message
          if (!disabled) pick(e.dataTransfer.files);
        }}
      >
        <motion.span
          className="lp-drop__icon"
          aria-hidden="true"
          animate={drag === "pdf" ? { y: [0, -8, 0] } : { y: 0 }}
          transition={drag === "pdf" ? { duration: 0.7, repeat: Infinity, ease: "easeInOut" } : { duration: 0.2 }}
        >
          <CloudUploadIcon size={46} />
        </motion.span>

        <AnimatePresence mode="wait" initial={false}>
          <motion.h2 key={heading} id="upload-title" className="lp-drop__title" {...swap}>
            {heading}
          </motion.h2>
        </AnimatePresence>
        <p className="lp-drop__hint">
          PDF only, up to {MAX_UPLOAD_MB} MB. We&rsquo;ll read it and show you what it can cost.
        </p>

        <AnimatePresence initial={false}>
          {error ? (
            <motion.div key={error.title} className="lp-drop__error" {...swap}>
              <ErrorNotice error={error} onResume={onResume} />
            </motion.div>
          ) : null}
        </AnimatePresence>

        <div className="lp-drop__actions">
          {/* The input is the real, labelled control; the label is the visible button. */}
          <input
            ref={inputRef}
            id="pdf-input"
            className="lp-drop__input"
            type="file"
            accept="application/pdf,.pdf"
            disabled={disabled}
            onChange={(e) => pick(e.target.files)}
          />
          <label htmlFor="pdf-input" className="lp-btn lp-btn--primary">
            <UploadIcon size={20} />
            {error ? "Choose another PDF" : "Choose a PDF"}
          </label>
          <button
            type="button"
            className="lp-btn lp-btn--outline"
            onClick={onSample}
            disabled={disabled || sampleBusy}
            aria-busy={sampleBusy || undefined}
          >
            {sampleBusy ? <span className="lp-spinner" aria-hidden="true" /> : <DocIcon size={20} />}
            {sampleBusy ? "Loading sample…" : "Try a sample lease"}
          </button>
        </div>
      </div>
    </section>
  );
}
