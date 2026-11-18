import type { Severity } from "@fineprint/shared";

interface IconProps {
  size?: number;
}

function Svg({
  size = 16,
  children,
}: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

/** Each severity has a distinct shape so it never relies on color alone. */
export function SeverityIcon({ severity, size }: { severity: Severity } & IconProps) {
  switch (severity) {
    case "critical":
      return (
        <Svg size={size}>
          <path d="M8.5 2h7L22 8.5v7L15.5 22h-7L2 15.5v-7z" />
          <path d="M12 7v6M12 16.5v.01" />
        </Svg>
      );
    case "high":
      return (
        <Svg size={size}>
          <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
          <path d="M12 9v4M12 17v.01" />
        </Svg>
      );
    case "medium":
      return (
        <Svg size={size}>
          <circle cx="12" cy="12" r="10" />
          <path d="M12 8v4M12 16v.01" />
        </Svg>
      );
    default:
      return (
        <Svg size={size}>
          <circle cx="12" cy="12" r="10" />
          <path d="M12 16v-5M12 8v.01" />
        </Svg>
      );
  }
}

export function CheckIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M20 6 9 17l-5-5" />
    </Svg>
  );
}

export function UploadIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M12 16V4M7 9l5-5 5 5M4 20h16" />
    </Svg>
  );
}

export function CalendarIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </Svg>
  );
}

export function CloseIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M18 6 6 18M6 6l12 12" />
    </Svg>
  );
}

export function DocIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6M8 13h8M8 17h8" />
    </Svg>
  );
}

export function InfoIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-5M12 8v.01" />
    </Svg>
  );
}

export function AlertIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 7v6M12 16.5v.01" />
    </Svg>
  );
}

/* ---------- Landing page ---------- */

export function HomeIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" />
    </Svg>
  );
}

export function FolderIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <path d="M3 11h18" />
    </Svg>
  );
}

export function PlayBadgeIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M12 2.5 20 6v6c0 4.5-3.4 8.3-8 9.5-4.6-1.2-8-5-8-9.5V6z" />
      <path d="m10 8.5 5 3.5-5 3.5z" />
    </Svg>
  );
}

export function HelpIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="12" r="10" />
      <path d="M9.2 9a3 3 0 0 1 5.8 1c0 2-3 2.5-3 4.5M12 17.5v.01" />
    </Svg>
  );
}

export function SparkleIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M10 3.5 11.6 8a2 2 0 0 0 1.4 1.4l4.5 1.6-4.5 1.6a2 2 0 0 0-1.4 1.4L10 18.5 8.4 14a2 2 0 0 0-1.4-1.4L2.5 11 7 9.4A2 2 0 0 0 8.4 8z" />
      <path d="M18.5 2.5v4M16.5 4.5h4M19 16v3M17.5 17.5h3" />
    </Svg>
  );
}

export function BoltIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M13 2 4 14h7l-1 8 9-12h-7z" />
    </Svg>
  );
}

export function ShieldCheckIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M12 2.5 20 6v6c0 4.5-3.4 8.3-8 9.5-4.6-1.2-8-5-8-9.5V6z" />
      <path d="m8.5 12 2.5 2.5 4.5-5" />
    </Svg>
  );
}

export function CloudUploadIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M7 18a5 5 0 0 1-.6-9.96A6 6 0 0 1 18 8.5h.5a4.5 4.5 0 0 1 0 9H17" />
      <path d="M12 21v-9M8.5 15.5 12 12l3.5 3.5" />
    </Svg>
  );
}

export function BarsIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M5 20v-6M12 20V10M19 20V4" />
    </Svg>
  );
}

export function ClockIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </Svg>
  );
}

export function MenuIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </Svg>
  );
}

export function ArrowRightIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </Svg>
  );
}

/** Filled warning triangle, for the illustration's fee card. */
export function WarningFilledIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M10.3 3.6a2 2 0 0 1 3.4 0l8.2 14.2A2 2 0 0 1 20.2 21H3.8a2 2 0 0 1-1.7-3.2z" fill="#f59e0b" />
      <path d="M12 9v5M12 17.2v.01" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}
