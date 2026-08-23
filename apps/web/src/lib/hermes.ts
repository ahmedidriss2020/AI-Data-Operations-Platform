import 'server-only';

import { mintScopeToken } from '@/lib/tool-layer/scope-token';

/**
 * The authenticated bridge to the Hermes agent (PRD v3 section 11).
 *
 * The whole point of this module is that it is the *only* way the product
 * talks to Hermes, and it lives strictly on the server:
 *
 *   browser -> AnalyzeIt route handler -> here -> Hermes -> controlled tools
 *
 * The `server-only` import above turns "don't import this from a client
 * component" into a build error rather than a code-review convention. If this
 * module ever reached the browser bundle it would take HERMES_API_SECRET with
 * it, and that secret is what authenticates every tool call the agent can make.
 *
 * Two rules this module enforces so callers cannot forget them:
 *
 *   1. The secret never appears in a return value, an error message or a log
 *      line. Hermes errors are summarised, not forwarded verbatim, because an
 *      upstream stack trace can echo request headers.
 *   2. Every call is bounded by a timeout. A hung agent must surface as a
 *      failed request, not as a page that spins forever.
 */

/** Envelope every Hermes tool returns (PRD v3 section 7). */
export type HermesEnvelope<T = unknown> = {
  status: 'ok' | 'error' | 'blocked';
  result: T;
  evidence?: unknown;
  warnings?: string[];
  execution_metadata?: {
    tool?: string;
    duration_ms?: number;
    model?: string;
    dry_run?: boolean;
    [key: string]: unknown;
  };
};

export type HermesHealth = {
  configured: boolean;
  reachable: boolean;
  status?: string;
  uptime?: string;
  queueDepth?: number;
  activeWorkers?: number;
  /** Present when reachable is false. Safe to show a user; never contains secrets. */
  detail?: string;
};

export type HermesChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

export class HermesError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'HermesError';
  }
}

const DEFAULT_TIMEOUT_MS = 60_000;
const HEALTH_TIMEOUT_MS = 5_000;

function endpoint(): string | null {
  const raw = process.env.HERMES_AGENT_ENDPOINT?.trim();
  if (!raw) return null;
  return raw.replace(/\/+$/, '');
}

/**
 * Whether the bridge has both halves of its configuration.
 *
 * Callers check this instead of letting a request fail deep inside fetch, so
 * the UI can say "the agent is not connected yet" -- which is true and
 * actionable -- rather than showing a generic network error.
 */
export function isHermesConfigured(): boolean {
  return Boolean(endpoint() && process.env.HERMES_API_SECRET);
}

async function call<T>(
  path: string,
  payload: unknown,
  { timeoutMs = DEFAULT_TIMEOUT_MS }: { timeoutMs?: number } = {},
): Promise<T> {
  const base = endpoint();
  const secret = process.env.HERMES_API_SECRET;

  if (!base || !secret) {
    throw new HermesError(
      'Hermes is not configured. Set HERMES_AGENT_ENDPOINT and HERMES_API_SECRET on the server.',
      503,
    );
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(`${base}${path}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
      cache: 'no-store',
    });
  } catch (error) {
    // Includes the abort. Deliberately does not interpolate the error object:
    // a fetch failure can carry the full request, headers included.
    const timedOut = error instanceof Error && error.name === 'AbortError';
    throw new HermesError(
      timedOut
        ? `Hermes did not respond within ${Math.round(timeoutMs / 1000)}s`
        : 'Could not reach the Hermes agent',
      504,
    );
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    // Upstream bodies are read but not forwarded -- see rule 1 above. The
    // status code is the part that is safe and useful.
    console.error(`[hermes] ${path} responded ${response.status}`);
    throw new HermesError(
      response.status === 401 || response.status === 403
        ? 'Hermes rejected the credentials for this deployment'
        : `Hermes returned an error (${response.status})`,
      502,
    );
  }

  return (await response.json()) as T;
}

/**
 * Liveness for the sidebar indicator.
 *
 * Never throws: an unreachable agent is a state the dashboard renders, not an
 * error that should break the page around it.
 */
export async function hermesHealth(): Promise<HermesHealth> {
  const base = endpoint();

  if (!isHermesConfigured()) {
    return { configured: false, reachable: false, detail: 'Not configured' };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);

  try {
    const response = await fetch(`${base}/health`, {
      headers: { authorization: `Bearer ${process.env.HERMES_API_SECRET}` },
      signal: controller.signal,
      cache: 'no-store',
    });

    if (!response.ok) {
      return { configured: true, reachable: false, detail: `HTTP ${response.status}` };
    }

    const body = (await response.json()) as {
      status?: string;
      uptime?: string;
      queue_depth?: number;
      active_workers?: number;
    };

    return {
      configured: true,
      reachable: true,
      status: body.status,
      uptime: body.uptime,
      queueDepth: body.queue_depth,
      activeWorkers: body.active_workers,
    };
  } catch {
    return { configured: true, reachable: false, detail: 'Unreachable' };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Ask Hermes a question inside one workspace.
 *
 * The workspace id is passed to the agent so its tool calls stay scoped, but
 * that is a convenience for Hermes, not a security boundary -- the caller has
 * already proven access via requireWorkspaceAccess, and the controlled tool
 * layer re-authorizes org -> workspace -> client on every operation
 * (PRD v3 section 8). Never treat a value the agent echoes back as proof of
 * anything.
 */
export async function hermesChat(input: {
  workspaceId: string;
  orgId: string;
  userId: string;
  message: string;
  history: HermesChatMessage[];
}): Promise<HermesEnvelope<{ reply: string }>> {
  // The scope token is the capability Hermes spends on its way back in. It is
  // minted here, after the caller's access was proven, and it is what the tool
  // layer trusts -- the workspace_id below is context for the agent's prompt,
  // never the thing that authorizes a tool call.
  const scopeToken = mintScopeToken({
    orgId: input.orgId,
    workspaceId: input.workspaceId,
    userId: input.userId,
  });

  return call<HermesEnvelope<{ reply: string }>>('/api/v1/chat', {
    workspace_id: input.workspaceId,
    org_id: input.orgId,
    message: input.message,
    history: input.history,
    // Hermes echoes this on every call it makes back to /api/tools/*.
    scope_token: scopeToken,
    tool_layer_url: process.env.TOOL_LAYER_PUBLIC_URL ?? null,
  });
}

/**
 * Invoke one tool from the contract in PRD v3 section 7.
 *
 * `dry_run` defaults to true. Every mutating tool supports it, and defaulting
 * to the non-mutating path means a forgotten argument produces a preview
 * rather than an unreviewed change to a client's financial data.
 */
export async function hermesTool<T = unknown>(
  tool: string,
  params: Record<string, unknown>,
  options: { dryRun?: boolean; timeoutMs?: number } = {},
): Promise<HermesEnvelope<T>> {
  const { dryRun = true, timeoutMs } = options;
  return call<HermesEnvelope<T>>(
    `/api/v1/tools/${tool}`,
    { ...params, dry_run: dryRun },
    { timeoutMs },
  );
}
