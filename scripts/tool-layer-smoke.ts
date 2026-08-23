/**
 * Scope-token boundary checks for the controlled tool layer.
 *
 * PRD v3 section 7 puts the tool layer between the agent and client financial
 * data, and section 8 requires authorization on every operation. The property
 * that makes that true is narrow and worth testing directly: the workspace a
 * tool call runs against comes from a signed token, not from anything the agent
 * sends. If a forged, tampered or expired token were ever accepted, an agent
 * could read another accounting firm's books -- so these run on every change.
 *
 * No database or running server needed: this exercises the signing boundary in
 * isolation, which is where the guarantee actually lives.
 *
 * Usage: npm run test:tool-layer
 */

import { createRequire } from 'node:module';
import Module from 'node:module';

process.env.TOOL_LAYER_SECRET ||= 'test-secret-that-is-at-least-32-characters-long';

// scope-token.ts imports `server-only`, which throws outside Next's bundler.
// That guard is load-bearing -- it is what stops the signing secret reaching a
// client bundle -- so it stays, and the test resolves the specifier to an empty
// stub instead of weakening the module under test.
const require_ = createRequire(import.meta.url);
const stub = require_.resolve('./support/server-only-stub.cjs');
const internal = Module as unknown as {
  _resolveFilename: (request: string, ...rest: unknown[]) => string;
};
const resolveFilename = internal._resolveFilename;
internal._resolveFilename = function (request: string, ...rest: unknown[]) {
  return request === 'server-only'
    ? stub
    : resolveFilename.call(this, request, ...rest);
};

// require rather than dynamic import: this file transpiles to CJS, where a
// top-level await is not available.
const { mintScopeToken, verifyScopeToken, ScopeTokenError } = require_(
  '../apps/web/src/lib/tool-layer/scope-token',
) as typeof import('../apps/web/src/lib/tool-layer/scope-token');

let passed = 0;
const failures: string[] = [];

function check(name: string, condition: boolean, detail = '') {
  if (condition) {
    passed += 1;
    console.log(`  PASS  ${name}`);
  } else {
    failures.push(`${name}${detail ? ` -- ${detail}` : ''}`);
    console.log(`  FAIL  ${name}${detail ? ` -- ${detail}` : ''}`);
  }
}

/** Returns the ScopeTokenError message, or null if verification wrongly passed. */
function rejects(token: string): string | null {
  try {
    verifyScopeToken(token);
    return null;
  } catch (error) {
    return error instanceof ScopeTokenError ? error.message : 'non-scope error';
  }
}

const SCOPE = {
  orgId: '11111111-1111-1111-1111-111111111111',
  workspaceId: '22222222-2222-2222-2222-222222222222',
  userId: '33333333-3333-3333-3333-333333333333',
};

const OTHER_WORKSPACE = '99999999-9999-9999-9999-999999999999';

console.log('\nScope token boundary\n');

// --- 1. A token minted from a proven scope round-trips unchanged.
const valid = mintScopeToken(SCOPE);
const decoded = verifyScopeToken(valid);
check(
  'valid token round-trips with its scope intact',
  decoded.orgId === SCOPE.orgId &&
    decoded.workspaceId === SCOPE.workspaceId &&
    decoded.userId === SCOPE.userId,
);
check('token carries a unique delegation id', typeof decoded.jti === 'string' && decoded.jti.length > 0);

// --- 2. Tampering with the payload to point at another workspace must fail.
//        This is the attack that matters: the agent rewriting its own scope.
const [version, payload] = valid.split('.');
const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
claims.workspaceId = OTHER_WORKSPACE;
const tampered = `${version}.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.${valid.split('.')[2]}`;
check('tampered workspace is rejected', rejects(tampered) === 'Scope token signature is invalid');

// --- 3. A signature forged without the secret must fail.
const forged = `${version}.${payload}.${Buffer.from('not-the-real-signature').toString('base64url')}`;
check('forged signature is rejected', rejects(forged) !== null);

// --- 4. Expiry is enforced. Tokens cross an agent runtime we do not control,
//        so an old one turning up later must not still work.
const expired = mintScopeToken(SCOPE, -1);
check('expired token is rejected', rejects(expired) === 'Scope token has expired');

// --- 5. Structural garbage must not crash the verifier or slip through.
for (const [label, token] of [
  ['missing token', ''],
  ['not a token', 'garbage'],
  ['wrong version', valid.replace(/^v1\./, 'v2.')],
  ['too few parts', valid.split('.').slice(0, 2).join('.')],
] as const) {
  check(`${label} is rejected`, rejects(token) !== null);
}

// --- 6. A token signed with a different secret must not verify. This is the
//        cross-deployment case: a staging token must be worthless in production.
const realSecret = process.env.TOOL_LAYER_SECRET;
process.env.TOOL_LAYER_SECRET = 'a-completely-different-secret-32-chars-plus';
const foreign = mintScopeToken(SCOPE);
process.env.TOOL_LAYER_SECRET = realSecret;
check('token from another deployment is rejected', rejects(foreign) !== null);

// --- 7. A refusal to sign without a secret, rather than signing with a weak one.
process.env.TOOL_LAYER_SECRET = 'too-short';
let refused = false;
try {
  mintScopeToken(SCOPE);
} catch (error) {
  refused = error instanceof ScopeTokenError;
}
process.env.TOOL_LAYER_SECRET = realSecret;
check('refuses to sign with a secret under 32 characters', refused);

console.log(`\n${passed} passed, ${failures.length} failed\n`);

if (failures.length > 0) {
  console.error('The tool layer boundary is not holding:');
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
