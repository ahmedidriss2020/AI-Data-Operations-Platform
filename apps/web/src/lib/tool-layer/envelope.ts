import 'server-only';

/**
 * The response shape every tool returns (PRD v3 section 7).
 *
 * `evidence` is not decoration. Section 10 requires that a displayed number
 * trace to source rows, SQL and dataset version, and a tool that returns a
 * figure without saying where it came from cannot support that promise. Tools
 * that compute anything should populate it.
 */

export type ToolStatus = 'ok' | 'blocked' | 'error' | 'not_implemented';

export type ToolEnvelope<T = unknown> = {
  status: ToolStatus;
  result: T;
  evidence?: unknown;
  warnings?: string[];
  execution_metadata: {
    tool: string;
    duration_ms: number;
    dry_run: boolean;
    workspace_id: string;
    /** The delegation this call ran under, so an audit row ties back to it. */
    scope_jti: string;
    [key: string]: unknown;
  };
};

export type EnvelopeMeta = {
  tool: string;
  startedAt: number;
  dryRun: boolean;
  workspaceId: string;
  scopeJti: string;
};

function metadata(meta: EnvelopeMeta, extra: Record<string, unknown> = {}) {
  return {
    tool: meta.tool,
    duration_ms: Date.now() - meta.startedAt,
    dry_run: meta.dryRun,
    workspace_id: meta.workspaceId,
    scope_jti: meta.scopeJti,
    ...extra,
  };
}

export function ok<T>(
  meta: EnvelopeMeta,
  result: T,
  extras: { evidence?: unknown; warnings?: string[]; metadata?: Record<string, unknown> } = {},
): ToolEnvelope<T> {
  return {
    status: 'ok',
    result,
    evidence: extras.evidence,
    warnings: extras.warnings,
    execution_metadata: metadata(meta, extras.metadata),
  };
}

/**
 * The run cannot proceed and a human must look (section 10's Block tier).
 *
 * Distinct from `error`: blocked means the tool worked correctly and the answer
 * is "stop", which is a valid and important outcome -- a failing invariant is
 * the system doing its job, not malfunctioning.
 */
export function blocked(meta: EnvelopeMeta, reason: string, evidence?: unknown): ToolEnvelope<null> {
  return {
    status: 'blocked',
    result: null,
    evidence,
    warnings: [reason],
    execution_metadata: metadata(meta),
  };
}

/**
 * The tool exists in the contract but its compute layer is not built yet.
 *
 * This status exists so the layer never fabricates a plausible-looking result.
 * An agent that receives `not_implemented` can say so; an agent that receives
 * invented numbers will present them to an accountant as fact, and in this
 * product that is the worst failure mode there is.
 */
export function notImplemented(meta: EnvelopeMeta, needs: string): ToolEnvelope<null> {
  return {
    status: 'not_implemented',
    result: null,
    warnings: [`Not implemented yet: ${needs}`],
    execution_metadata: metadata(meta, { needs }),
  };
}

export function failed(meta: EnvelopeMeta, message: string): ToolEnvelope<null> {
  return {
    status: 'error',
    result: null,
    warnings: [message],
    execution_metadata: metadata(meta),
  };
}
