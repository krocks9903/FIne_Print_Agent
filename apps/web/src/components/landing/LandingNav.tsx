"use client";

import { useEffect, useRef, useState } from "react";
import { ClockIcon, CloseIcon, FolderIcon, HelpIcon, HomeIcon, MenuIcon, PlayBadgeIcon } from "../Icons";
import { Logo } from "../Logo";

type SectionId = "analyze" | "how-it-works" | "faq";

const LINKS: Array<{ id: SectionId; label: string; Icon: typeof HomeIcon }> = [
  { id: "analyze", label: "Analyze", Icon: HomeIcon },
  { id: "how-it-works", label: "How It Works", Icon: PlayBadgeIcon },
  { id: "faq", label: "FAQ", Icon: HelpIcon },
];

interface Props {
  onSample: () => void;
  sampleBusy: boolean;
}

/** Highlights whichever section is nearest the top of the viewport. */
function useActiveSection(): SectionId {
  const [active, setActive] = useState<SectionId>("analyze");
  useEffect(() => {
    const els = LINKS.map((l) => document.getElementById(l.id)).filter(Boolean) as HTMLElement[];
    if (!("IntersectionObserver" in window) || els.length === 0) return;
    const visible = new Map<string, boolean>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) visible.set(e.target.id, e.isIntersecting);
        const first = LINKS.find((l) => visible.get(l.id));
        if (first) setActive(first.id);
      },
      { rootMargin: "-35% 0px -55% 0px" }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
  return active;
}

/** Dark top navigation for the landing page. Every item does something real. */
export function LandingNav({ onSample, sampleBusy }: Props) {
  const active = useActiveSection();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

  // Close the mobile menu on Escape or a click outside it.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        toggleRef.current?.focus();
      }
    };
    const onClick = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!menuRef.current?.contains(t) && !toggleRef.current?.contains(t)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  const items = (
    <>
      {LINKS.slice(0, 1).map(({ id, label, Icon }) => (
        <a
          key={id}
          href={`#${id}`}
          className={`lp-nav__link${active === id ? " lp-nav__link--active" : ""}`}
          aria-current={active === id ? "location" : undefined}
          onClick={() => setOpen(false)}
        >
          <Icon size={20} />
          {label}
        </a>
      ))}
      <button
        type="button"
        className="lp-nav__link"
        onClick={() => {
          setOpen(false);
          onSample();
        }}
        disabled={sampleBusy}
      >
        <FolderIcon size={20} />
        {sampleBusy ? "Loading sample…" : "Sample Lease"}
      </button>
      <a
        href="/mailbox"
        className="lp-nav__link"
        onClick={() => setOpen(false)}
      >
        <ClockIcon size={20} />
        Inbox
      </a>
      {LINKS.slice(1).map(({ id, label, Icon }) => (
        <a
          key={id}
          href={`#${id}`}
          className={`lp-nav__link${active === id ? " lp-nav__link--active" : ""}`}
          aria-current={active === id ? "location" : undefined}
          onClick={() => setOpen(false)}
        >
          <Icon size={20} />
          {label}
        </a>
      ))}
    </>
  );

  return (
    <header className="lp-nav">
      <div className="lp-nav__inner">
        <a href="#analyze" className="lp-nav__brand" aria-label="FinePrint, Lease and Contract Scanner">
          <Logo size={36} />
          <span className="lp-nav__word">FinePrint</span>
          <span className="lp-nav__divider" aria-hidden="true" />
          <span className="lp-nav__tag">Lease &amp; Contract Scanner</span>
        </a>
        <nav className="lp-nav__links" aria-label="Main">
          {items}
        </nav>
        <button
          ref={toggleRef}
          type="button"
          className="lp-nav__toggle"
          aria-expanded={open}
          aria-controls="lp-nav-menu"
          onClick={() => setOpen((o) => !o)}
        >
          {open ? <CloseIcon size={22} /> : <MenuIcon size={22} />}
          <span className="visually-hidden">{open ? "Close menu" : "Open menu"}</span>
        </button>
      </div>
      {open ? (
        <div ref={menuRef} id="lp-nav-menu" className="lp-nav__menu">
          <nav aria-label="Main">{items}</nav>
        </div>
      ) : null}
    </header>
  );
}
