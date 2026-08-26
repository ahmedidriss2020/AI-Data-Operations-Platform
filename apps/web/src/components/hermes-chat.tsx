'use client';

import { useEffect, useRef, useState } from 'react';

import { ErrorText, Spinner, buttonClass, buttonStyle, inputFocusHandler, inputStyle } from '@/components/ui';

type Turn = {
  role: 'user' | 'assistant';
  content: string;
  warnings?: string[];
  pending?: boolean;
};

/**
 * The accountant-facing chat surface (PRD v3 section 4) -- now presented as the
 * AI Bank Statement Analyzer, the app's single screen.
 *
 * What this component deliberately does not do is as important as what it does.
 * It shows the agent's prose and nothing else: no tool payloads, no model name,
 * no endpoint, no system prompt. Those belong to the operator's Hermes console,
 * and section 4 draws that line on purpose.
 *
 * The disclaimer under the composer is not decoration either. Section 17 makes
 * the positioning legally load-bearing -- AnalyzeIt is a copilot and the
 * accountant signs off -- so the interface has to say so where the answers
 * appear, not only in the terms of service.
 */
export function HermesChat({
  workspaceId,
  workspaceName,
}: {
  workspaceId: string;
  workspaceName: string;
}) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [turns]);

  async function send() {
    const message = draft.trim();
    if (!message || busy) return;

    setError(null);
    setBusy(true);
    setDraft('');

    // The history sent upstream is the state *before* this turn, so the agent
    // never receives the pending placeholder as if it were a real reply.
    const history = turns
      .filter((turn) => !turn.pending)
      .map(({ role, content }) => ({ role, content }));

    setTurns((current) => [
      ...current,
      { role: 'user', content: message },
      { role: 'assistant', content: '', pending: true },
    ]);

    try {
      const response = await fetch('/api/hermes/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ workspaceId, message, history }),
      });

      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? 'The agent could not answer');

      setTurns((current) => [
        ...current.slice(0, -1),
        { role: 'assistant', content: body.reply || '(no answer returned)', warnings: body.warnings },
      ]);
    } catch (caught) {
      // Drop the placeholder *and* the question. Leaving an unanswered question
      // in the transcript would send it again as history on the next turn.
      setTurns((current) => current.slice(0, -2));
      setDraft(message);
      setError(caught instanceof Error ? caught.message : 'The agent could not answer');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-[32rem] min-h-[26rem] flex-col">
      <div
        ref={scrollRef}
        className="flex-1 space-y-4 overflow-y-auto rounded-2xl border p-5"
        style={{ borderColor: 'var(--az-border)', background: 'var(--az-bg-sidebar)' }}
      >
        {turns.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
            <p className="text-sm font-semibold text-slate-300">
              Ask about {workspaceName}&apos;s bank statements
            </p>
            <p className="max-w-md text-xs leading-relaxed text-slate-500">
              Questions are answered by running tools over the statements uploaded for this
              client, so every number traces back to its source rows, dataset version and the file
              it came from. Try &ldquo;what were the largest payments last month?&rdquo;
            </p>
          </div>
        )}

        {turns.map((turn, index) => (
          <div
            key={index}
            className={`flex ${turn.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className="max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed"
              style={
                turn.role === 'user'
                  ? { background: 'rgba(16,185,129,.14)', border: '1px solid rgba(16,185,129,.3)', color: '#d1fae5' }
                  : { background: 'var(--az-bg-input)', border: '1px solid var(--az-border)', color: 'var(--az-text)' }
              }
            >
              {turn.pending ? (
                <span className="flex items-center gap-2 text-slate-400">
                  <Spinner size={14} />
                  Analyzing the statements…
                </span>
              ) : (
                <span className="whitespace-pre-wrap">{turn.content}</span>
              )}

              {turn.warnings && turn.warnings.length > 0 && (
                <ul className="mt-3 space-y-1 border-t pt-2 text-xs text-amber-300" style={{ borderColor: 'var(--az-border)' }}>
                  {turn.warnings.map((warning, i) => (
                    <li key={i}>⚠ {warning}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ))}
      </div>

      {error && (
        <div className="mt-3">
          <ErrorText>{error}</ErrorText>
        </div>
      )}

      <div className="mt-4 flex items-end gap-3">
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              void send();
            }
          }}
          rows={2}
          placeholder="Ask about this client's bank statements… (Enter to send, Shift+Enter for a new line)"
          className="w-full resize-none rounded-xl px-4 py-3 text-sm outline-none transition-all duration-200 placeholder:text-slate-500"
          style={inputStyle}
          {...inputFocusHandler}
          disabled={busy}
        />
        <button
          type="button"
          onClick={() => void send()}
          disabled={busy || draft.trim().length === 0}
          className={`${buttonClass} shrink-0 disabled:cursor-not-allowed disabled:opacity-50`}
          style={buttonStyle}
        >
          {busy ? <Spinner size={16} /> : 'Send'}
        </button>
      </div>

      <p className="mt-3 text-center text-[11px] leading-relaxed text-slate-500">
        The analyzer proposes and explains; deterministic tools calculate. Every figure traces to
        source rows. Material changes still require your sign-off.
      </p>
    </div>
  );
}
