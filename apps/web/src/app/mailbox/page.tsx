"use client";

import { MotionConfig } from "motion/react";
import { MailboxApp } from "@/components/MailboxApp";

export default function MailboxPage() {
  return (
    <MotionConfig reducedMotion="user">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <MailboxApp />
    </MotionConfig>
  );
}
