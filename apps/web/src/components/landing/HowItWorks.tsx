import { ArrowRightIcon, BarsIcon, SparkleIcon, UploadIcon } from "../Icons";

const STEPS = [
  { Icon: UploadIcon, title: "1. Upload", text: "Add your lease or contract (PDF)" },
  { Icon: SparkleIcon, title: "2. Analyze", text: "We extract terms, fees, and key details" },
  { Icon: BarsIcon, title: "3. Get Results", text: "See the cost breakdown and red flags" },
] as const;

export function HowItWorks() {
  return (
    <section id="how-it-works" className="lp-steps" aria-labelledby="steps-title">
      <h2 id="steps-title" className="visually-hidden">
        How it works
      </h2>
      <ol className="lp-steps__list">
        {STEPS.map(({ Icon, title, text }, i) => (
          <li key={title} className="lp-steps__item">
            <div className="lp-step">
              <span className="lp-step__icon">
                <Icon size={26} />
              </span>
              <span>
                <span className="lp-step__title">{title}</span>
                <span className="lp-step__text">{text}</span>
              </span>
            </div>
            {i < STEPS.length - 1 ? (
              <span className="lp-steps__arrow" aria-hidden="true">
                <ArrowRightIcon size={20} />
              </span>
            ) : null}
          </li>
        ))}
      </ol>
    </section>
  );
}
