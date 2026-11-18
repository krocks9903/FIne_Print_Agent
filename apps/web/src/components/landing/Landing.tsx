"use client";

import type { ScanError } from "@/lib/errors";
import { Disclaimer } from "../Disclaimer";
import { UploadZone } from "../UploadZone";
import { Faq } from "./Faq";
import { HowItWorks } from "./HowItWorks";
import { LandingHero } from "./LandingHero";
import { LandingNav } from "./LandingNav";

interface Props {
  onFile: (file: File) => void;
  onSample: () => void;
  sampleBusy: boolean;
  error: ScanError | null;
  onResume?: () => void;
}

/** The home page: dark hero with nav, the upload card over the wave, steps and FAQ. */
export function Landing({ onFile, onSample, sampleBusy, error, onResume }: Props) {
  return (
    <div className="lp">
      <div className="lp-top">
        <LandingNav onSample={onSample} sampleBusy={sampleBusy} />
        <main id="main" tabIndex={-1} className="lp-top__main">
          <LandingHero />
        </main>
        <svg className="lp-wave" viewBox="0 0 1440 440" preserveAspectRatio="none" aria-hidden="true" focusable="false">
          <defs>
            <linearGradient id="lp-wave-band" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#c4b2ff" stopOpacity="0" />
              <stop offset="0.6" stopColor="#c4b2ff" stopOpacity="0.14" />
              <stop offset="1" stopColor="#cdbcff" stopOpacity="0.6" />
            </linearGradient>
            <linearGradient id="lp-wave-light" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#e9e3ff" />
              <stop offset="0.35" stopColor="#f3f1ff" />
            </linearGradient>
          </defs>
          <path
            fill="url(#lp-wave-band)"
            d="M0 396 C 300 362 700 364 1000 354 C 1120 348 1190 322 1250 282 C 1330 228 1395 122 1440 30 L1440 440 L0 440 Z"
          />
          <path
            fill="url(#lp-wave-light)"
            d="M0 404 C 150 382 260 374 400 372 L 1000 372 C 1120 368 1200 345 1255 316 C 1330 276 1390 210 1440 150 L1440 440 L0 440 Z"
          />
        </svg>
      </div>
      <div className="lp-body">
        <UploadZone onFile={onFile} onSample={onSample} sampleBusy={sampleBusy} error={error} onResume={onResume} />
        <HowItWorks />
        <Faq />
        <footer className="lp-foot">
          <Disclaimer />
        </footer>
      </div>
    </div>
  );
}
