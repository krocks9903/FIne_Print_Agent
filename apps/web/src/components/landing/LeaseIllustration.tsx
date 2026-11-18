import { CheckIcon, ClockIcon, WarningFilledIcon } from "../Icons";

/** Widths (%) of the text lines on the illustrated page; "hl" lines are highlighted clauses. */
const LINES: Array<{ w: number; hl?: "fill" | "ring" }> = [
  { w: 46 },
  { w: 88 },
  { w: 70, hl: "fill" },
  { w: 82 },
  { w: 34 },
  { w: 60, hl: "ring" },
  { w: 76 },
  { w: 90 },
  { w: 52 },
  { w: 0 },
  { w: 84 },
  { w: 64 },
];

/**
 * Hero art: a tilted lease page with highlighted clauses and three floating insight cards.
 * Everything here is sample data, labelled as such, not output from a real scan.
 */
export function LeaseIllustration() {
  return (
    <figure
      className="lp-art"
      aria-label="Example of what FinePrint flags, with sample data: an early-termination fee, the lease term, and a renewal notice deadline."
    >
      <div className="lp-art__stage" aria-hidden="true">
        <div className="lp-art__doc">
          <div className="lp-art__sheet lp-art__sheet--back" />
          <div className="lp-art__sheet">
            <p className="lp-art__heading">Lease Agreement</p>
            <div className="lp-art__lines">
              {LINES.map((l, i) =>
                l.w === 0 ? (
                  <span key={i} className="lp-art__gap" />
                ) : (
                  <span
                    key={i}
                    className={`lp-art__line${l.hl ? ` lp-art__line--${l.hl}` : ""}`}
                    style={{ width: `${l.w}%` }}
                  />
                )
              )}
            </div>
            <p className="lp-art__sample">Sample · not a real scan</p>
          </div>
        </div>

        <div className="lp-card lp-card--fee">
          <WarningFilledIcon size={22} />
          <div>
            <p className="lp-card__title">Potential Fee</p>
            <p className="lp-card__text">Early termination: $2,500</p>
          </div>
        </div>
        <div className="lp-card lp-card--term">
          <span className="lp-card__check">
            <CheckIcon size={18} />
          </span>
          <div>
            <p className="lp-card__title">Key Term</p>
            <p className="lp-card__text">Lease term: 36 months</p>
          </div>
        </div>
        <div className="lp-card lp-card--deadline">
          <span className="lp-card__clock">
            <ClockIcon size={22} />
          </span>
          <div>
            <p className="lp-card__title">Renewal Notice</p>
            <p className="lp-card__value">60 days before end</p>
          </div>
        </div>
      </div>
      <figcaption className="visually-hidden">Example results with sample data, not a real scan.</figcaption>
    </figure>
  );
}
