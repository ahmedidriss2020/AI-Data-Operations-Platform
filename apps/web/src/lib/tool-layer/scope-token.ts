import 'server-only';

import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';

/**
 * Scoped delegation tokens: the tenant boundary of the controlled tool layer
 * (PRD v3 sections 7 and 8).
 *
 * The problem this solves is specific. Hermes authenticates to the tool layer
 * with a shared secret, which proves *that the caller is Hermes* and nothing
 * else. If the tool layer then read `workspace_id` out of the request body, any
 * agent holding that secret could read any workspace in any organization -- a
 * confused agent, a prompt-injected one, or a buggy one would all cross the
 * tenant boundary without ever presenting a bad credential.
 *
 * So the workspace is not a parameter. When a route mints one of these, the
 * human's access has already been proven by requireWorkspaceAccess; the token
 * carries that proven scope, signed. The tool layer derives org, workspace and
 * user *from the token* and ignores anything the agent says about scope. An
 * agent cannot widen its own reach, because the reach is not something it sends.
 *
 * Tokens are deliberately short-lived. They travel through an agent runtime we
 * do not control, so treat every one as potentially logged somewhere: minutes
 * of validity, not hours.
 */

export type ToolScope = {
  orgId: string;
  workspaceId: string;
  userId: string;
  /** Unique per token, so an audit row can be tied back to one delegation. */
  jti: string;
  expiresAt: number;
};

export class ScopeTokenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ScopeTokenError';
  }
}

const VERSION = 'v1';
const DEFAULT_TTL_SECONDS = 15 * 60;

function secret(): string {
  const value = process.env.TOOL_LAYER_SECRET;
  if (!value || value.length < 32) {
    throw new ScopeTokenError(
      'TOOL_LAYER_SECRET is not set, or is shorter than 32 characters. ' +
        'The tool layer will not sign or accept scope tokens without it.',
    );
  }
  return value;
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url');
}

function sign(payload: string): string {
  return createHmac('sha256', secret()).update(payload).digest('base64url');
}

/**
 * Mint a token for a scope whose access has *already* been proven.
 *
 * The argument name says `provenScope` rather than `scope` because that is the
 * precondition: calling this with an unverified workspace id would hand out a
 * signed capability for data the caller never proved they could read.
 */
export function mintScopeToken(
  provenScope: { orgId: string; workspaceId: string; userId: string },
  ttlSeconds: number = DEFAULT_TTL_SECONDS,
): string {
  const claims: ToolScope = {
    ...provenScope,
    jti: randomUUID(),
    expiresAt: Math.floor(Date.now() / 1000) + ttlSeconds,
  };

  const payload = b64url(JSON.stringify(claims));
  return `${VERSION}.${payload}.${sign(payload)}`;
}

/**
 * Verify a token and return its scope.
 *
 * Signature is checked before the payload is trusted for anything, and compared
 * with timingSafeEqual so the comparison does not leak how much of a forged
 * signature was correct.
 */
export function verifyScopeToken(token: string | null | undefined): ToolScope {
  if (!token) throw new ScopeTokenError('Missing scope token');

  const parts = token.split('.');
  if (parts.length !== 3 || parts[0] !== VERSION) {
    throw new ScopeTokenError('Malformed scope token');
  }

  const [, payload, provided] = parts;

  const expected = Buffer.from(sign(payload));
  const actual = Buffer.from(provided);

  // timingSafeEqual throws on a length mismatch, which is itself a signal, so
  // the length check comes first and fails the same way as a bad signature.
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    throw new ScopeTokenError('Scope token signature is invalid');
  }

  let claims: ToolScope;
  try {
    claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as ToolScope;
  } catch {
    throw new ScopeTokenError('Scope token payload is not readable');
  }

  if (!claims.orgId || !claims.workspaceId || !claims.userId || !claims.jti) {
    throw new ScopeTokenError('Scope token is missing required claims');
  }

  if (typeof claims.expiresAt !== 'number' || claims.expiresAt * 1000 <= Date.now()) {
    throw new ScopeTokenError('Scope token has expired');
  }

  return claims;
}
