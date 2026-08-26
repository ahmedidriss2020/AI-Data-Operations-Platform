import { Card } from '@/components/ui';

/**
 * The "what is this?" panel on the analyzer page.
 *
 * The app used to be a suite -- workspaces, recipes, an exception queue, an
 * audit browser -- and the copilot was one tab among six. Now the copilot is
 * the whole product, which means the page has to answer, without being asked,
 * what the thing in front of you does and where its numbers come from. Claims
 * here are deliberately limited to what the tool layer actually performs.
 */

const STEPS = [
  {
    title: 'Upload the statement',
    body: 'Drop in a bank statement export (.csv, .xlsx or .xls). Every file is fingerprinted with SHA-256, versioned and stored encrypted, so the exact file behind an answer is always identifiable.',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="17 8 12 3 7 8" />
        <line x1="12" y1="3" x2="12" y2="15" />
      </svg>
    ),
  },
  {
    title: 'It gets read and cleaned',
    body: 'Headers, blank and subtotal rows, date formats and bracketed negatives are normalised into one consistent transaction table — date, description, money in, money out, balance.',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 6h18" />
        <path d="M7 12h13" />
        <path d="M7 18h9" />
        <path d="M3 12h.01" />
        <path d="M3 18h.01" />
      </svg>
    ),
  },
  {
    title: 'Ask it questions',
    body: 'Ask in plain English — totals, largest payments, recurring subscriptions, duplicate charges, a month-on-month comparison. Answers are computed by running tools over your rows, not written from memory.',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    ),
  },
  {
    title: 'Check the working',
    body: 'Every figure traces back to the source rows, the dataset version and the file it came from. You review and sign off; the analyzer never files anything on your behalf.',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        <polyline points="9 12 11 14 15 10" />
      </svg>
    ),
  },
];

const EXAMPLE_QUESTIONS = [
  'What did this client spend on subscriptions last month?',
  'List every payment over £1,000 and who it went to.',
  'Are there any duplicate transactions in this statement?',
  'Which payments recur every month?',
  'Show the largest gap between money in and money out.',
];

export function AnalyzerIntro() {
  return (
    <Card variant="gradient" className="space-y-5 border-emerald-500/30">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-extrabold text-slate-100">
          <span aria-hidden>💡</span>
          What the AI Bank Statement Analyzer does
        </h2>
        <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-400">
          Plain English Guide
        </span>
      </div>

      <p className="max-w-3xl text-sm leading-relaxed text-slate-300">
        This is a bank statement reader for accountants and analysts. You give it a client&apos;s raw
        bank statement export, it turns that file into a clean, versioned transaction table, and then
        you interrogate it in plain English instead of building another spreadsheet. The numbers in
        an answer are calculated from your uploaded rows by deterministic tools — the model chooses
        which tool to run and explains the result, it does not invent the figures.
      </p>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((step, index) => (
          <div
            key={step.title}
            className="space-y-2 rounded-xl border border-slate-800 bg-slate-950/60 p-3.5"
          >
            <div className="flex items-center gap-2">
              <span
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-emerald-400"
                style={{ background: 'rgba(16,185,129,.12)', border: '1px solid rgba(16,185,129,.25)' }}
              >
                {step.icon}
              </span>
              <p className="text-xs font-bold text-emerald-400">
                {index + 1}. {step.title}
              </p>
            </div>
            <p className="text-xs leading-relaxed text-slate-300">{step.body}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-2">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Things you can ask
          </p>
          <ul className="space-y-1.5">
            {EXAMPLE_QUESTIONS.map((question) => (
              <li key={question} className="flex gap-2 text-xs leading-relaxed text-slate-300">
                <span className="text-emerald-400" aria-hidden>
                  ›
                </span>
                <span>{question}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-2">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            What it will not do
          </p>
          <ul className="space-y-1.5 text-xs leading-relaxed text-slate-300">
            <li className="flex gap-2">
              <span className="text-slate-500" aria-hidden>
                ›
              </span>
              <span>
                Guess at a number it cannot compute. If a statement does not contain the answer, it
                says so rather than estimating.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-slate-500" aria-hidden>
                ›
              </span>
              <span>
                Give tax, audit or accounting advice, or make a filing. It is a copilot; a qualified
                person signs off every material judgement.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-slate-500" aria-hidden>
                ›
              </span>
              <span>
                Mix clients together. Each question is answered against one client&apos;s data only,
                scoped by the client selected above.
              </span>
            </li>
          </ul>
        </div>
      </div>
    </Card>
  );
}
