import { MAX_UPLOAD_MB } from "@/lib/errors";
import { CHECKED_FOR } from "@/lib/findings";

const QUESTIONS: Array<{ q: string; a: string }> = [
  {
    q: "Is this legal advice?",
    a: "No. FinePrint points out clauses that can cost you money and quotes them word for word. It may miss things, and it doesn’t say whether a clause is enforceable. For a decision that matters, ask a lawyer or a tenant-rights office.",
  },
  {
    q: "How do I know a finding is real?",
    a: "Every finding quotes the exact sentence and page it comes from. Before you see anything, FinePrint checks each quote against your document and throws out any it can’t find there.",
  },
  {
    q: "What does it check for?",
    a: `Money-loss clauses: ${CHECKED_FOR}.`,
  },
  {
    q: "What files can I upload?",
    a: `PDFs up to ${MAX_UPLOAD_MB} MB. Text-based PDFs work best (ones where you can select the words). Photos or scans of paper can’t be read yet, and FinePrint tells you which pages it couldn’t read.`,
  },
  {
    q: "What happens to my document?",
    a: "It’s saved on the server running FinePrint so your results can load, and so the same file scans instantly next time. FinePrint is a student prototype, so don’t upload documents with information you wouldn’t want stored.",
  },
];

export function Faq() {
  return (
    <section id="faq" className="lp-faq" aria-labelledby="faq-title">
      <h2 id="faq-title" className="lp-faq__title">
        Frequently asked questions
      </h2>
      <div className="lp-faq__list">
        {QUESTIONS.map(({ q, a }) => (
          <details key={q} className="lp-faq__item">
            <summary className="lp-faq__q">{q}</summary>
            <p className="lp-faq__a">{a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
