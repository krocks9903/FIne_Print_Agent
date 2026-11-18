"use client";

import { motion } from "motion/react";
import { BoltIcon, DocIcon, ShieldCheckIcon, SparkleIcon } from "../Icons";
import { LeaseIllustration } from "./LeaseIllustration";

const FEATURES = [
  { Icon: BoltIcon, tone: "violet", title: "Cost Breakdown", text: "See every fee and charge" },
  { Icon: ShieldCheckIcon, tone: "teal", title: "Risk Flags", text: "Spot hidden fees & risky terms" },
  { Icon: DocIcon, tone: "blue", title: "Key Terms", text: "Get a simple summary" },
] as const;

const rise = (delay: number) => ({
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] as const },
});

export function LandingHero() {
  return (
    <section className="lp-hero" aria-labelledby="lp-title">
      <div className="lp-hero__copy">
        <motion.p className="lp-pill" {...rise(0)}>
          <SparkleIcon size={18} /> AI Contract Analyzer
        </motion.p>
        <motion.h1 id="lp-title" className="lp-hero__title" tabIndex={-1} {...rise(0.06)}>
          Know What Your
          <br />
          Lease <span className="lp-grad">Really Costs</span>
        </motion.h1>
        <motion.p className="lp-hero__lede" {...rise(0.14)}>
          Upload a lease or contract and get a clear, plain-English breakdown of costs, key
          terms, and potential red flags in minutes.
        </motion.p>
        <motion.ul className="lp-features" {...rise(0.22)}>
          {FEATURES.map(({ Icon, tone, title, text }) => (
            <li key={title} className="lp-feature">
              <span className={`lp-feature__icon lp-feature__icon--${tone}`}>
                <Icon size={22} />
              </span>
              <span>
                <span className="lp-feature__title">{title}</span>
                <span className="lp-feature__text">{text}</span>
              </span>
            </li>
          ))}
        </motion.ul>
      </div>
      <motion.div
        className="lp-hero__art"
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.7, delay: 0.18, ease: [0.22, 1, 0.36, 1] }}
      >
        <LeaseIllustration />
      </motion.div>
    </section>
  );
}
