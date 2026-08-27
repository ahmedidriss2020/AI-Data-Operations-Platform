import 'server-only';

/**
 * In-process conversational fallback for the chat surface.
 *
 * When the Python parser/agent (services/parser -- DuckDB + Polars + openpyxl)
 * is NOT reachable (no HERMES_AGENT_ENDPOINT), the dashboard still needs a
 * working chat. This module talks to OpenRouter directly from the Next.js
 * server runtime so chat is live on Vercel with no separate backend.
 *
 * Deliberately conversational-only: it has NO access to uploaded datasets
 * (those live in the parser's compute process). It therefore must NOT state
 * figures about a client's file -- PRD v3's rule "the LLM is never the source
 * of a financial number" holds here by construction. When the parser is
 * hosted and HERMES_AGENT_ENDPOINT is set, hermesChat() routes to the parser's
 * own /api/v1/chat instead (full tool-grounded analysis) and this fallback is
 * not used.
 */

const OPENROUTER_BASE_URL = (
  process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1'
).replace(/\/+$/, '');
const MODEL_PRIMARY = process.env.MODEL_PRIMARY || 'z-ai/glm-5.3-flash';
const MODEL_SECONDARY = process.env.MODEL_SECONDARY || '';

const SYSTEM_PROMPT = `You are the AnalyzeIt data-operations copilot for a UK accounting practice.
You help accountants understand their client bank statements and workbooks: what
the tool can do, how to prepare a file, what kinds of questions to ask, and how to
interpret results in plain English.

Important limits of THIS session:
- The data-analysis engine (which parses the uploaded file and runs SQL over it)
  is not connected to this reply path. You therefore CANNOT read the contents of
  any uploaded file right now.
- Never state, estimate, or invent any specific figure, total, transaction, date,
  or balance from a client's file. If asked to compute something from an upload,
  explain that live analysis is being connected and, once enabled, you will answer
  every number directly from their rows -- never from guesswork.
- You may explain features, guide the workflow, and answer general accounting-data
  and product questions.
- Be concise and businesslike. Lead with the answer, then at most one line of method.`;

export type ChatMessage = { role: 'user' | 'assistant'; content: string };

export type LocalChatResult = {
  reply: string;
  model: string;
  durationMs: number;
};

/** True when an in-process OpenRouter reply is possible. */
export function isLocalChatConfigured(): boolean {
  return Boolean(process.env.OPENROUTER_API_KEY);
}

/**
 * One conversational turn against OpenRouter, run inside the Next.js server.
 * No tools are advertised, so the model cannot fabricate data-backed numbers.
 */
export async function localChat(input: {
  message: string;
  history: ChatMessage[];
}): Promise<LocalChatResult> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) {
    throw new Error('OPENROUTER_API_KEY is not configured');
  }

  const messages: Array<{ role: string; content: string }> = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...input.history
      .filter((h) => h.role === 'user' || h.role === 'assistant')
      .slice(-12)
      .map((h) => ({ role: h.role, content: h.content })),
    { role: 'user', content: input.message },
  ];

  const modelsToTry = [MODEL_PRIMARY, MODEL_SECONDARY].filter(Boolean);
  const started = Date.now();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45_000);

  try {
    let lastError = '';
    for (const model of modelsToTry) {
      const resp = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${key}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages,
          max_tokens: 1200,
          temperature: 0.2,
        }),
        signal: controller.signal,
        cache: 'no-store',
      });

      if (resp.status === 429 && model !== modelsToTry[modelsToTry.length - 1]) {
        continue; // fall through to the secondary model
      }
      if (resp.status === 401) {
        throw new Error('OpenRouter rejected the API key');
      }
      if (!resp.ok) {
        lastError = `OpenRouter error ${resp.status}: ${(await resp.text()).slice(0, 200)}`;
        continue;
      }

      const data = (await resp.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const reply = data.choices?.[0]?.message?.content?.trim() || '';
      return { reply, model, durationMs: Date.now() - started };
    }

    throw new Error(lastError || 'OpenRouter returned no usable response');
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('OpenRouter did not respond within 45s');
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
