import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { z } from 'zod';

import { createAdminSupabase } from '@/lib/supabase/server';
import type { Json } from '@/lib/database.types';
import { failed } from '@/lib/tool-layer/envelope';
import { TOOLS, listTools } from '@/lib/tool-layer/tools';
import { ScopeTokenError, verifyScopeToken } from '@/lib/tool-layer/scope-token';

/**
 * The controlled tool layer (PRD v3 section 7): the single door through which
 * Hermes reaches client data.
 *
 * Two credentials are required and they prove different things:
 *
 *   Authorization: Bearer <TOOL_LAYER_SECRET>   -- the caller is our agent
 *   X-AnalyzeIt-Scope: <scope token>            -- on whose behalf, for which
 *                                                  workspace, proven earlier by
 *                                                  requireWorkspaceAccess
 *
 * The second is the one that matters. The bearer secret alone would let any
 * caller holding it name any workspace in the body and read it -- so the
 * workspace is never read from the body. It is derived from the signed token
 * and nothing the agent sends can widen it. An agent that has been
 * prompt-injected into asking for another firm's data gets its own scope back,
 * not the one it asked for.
 *
 * dry_run defaults to TRUE. Section 7 requires every mutating tool to support
 * it; defaulting it on means a forgotten flag produces a preview rather than an
 * unreviewed change to a client's financial data.
 */

const bodySchema = z.object({
  params: z.record(z.string(), z.unknown()).default({}),
  dry_run: z.boolean().default(true),
});

function bearerMatches(header: string | null): boolean {
  const expected = process.env.TOOL_LAYER_SECRET;
  if (!expected || !header?.startsWith('Bearer ')) return false;

  const provided = Buffer.from(header.slice('Bearer '.length));
  const wanted = Buffer.from(expected);

  return provided.length === wanted.length && timingSafeEqual(provided, wanted);
}

export async function POST(request: Request, { params }: RouteContext<'/api/tools/[tool]'>) {
  const { tool: toolName } = await params;
  const startedAt = Date.now();

  if (!process.env.TOOL_LAYER_SECRET) {
    console.error('[tools] TOOL_LAYER_SECRET is not set; refusing every call');
    return NextResponse.json({ error: 'Tool layer is not configured' }, { status: 503 });
  }

  if (!bearerMatches(request.headers.get('authorization'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let scope;
  try {
    scope = verifyScopeToken(request.headers.get('x-analyzeit-scope'));
  } catch (error) {
    // The reason is safe to return: it tells our own agent to request a fresh
    // delegation, and reveals nothing about what a valid token would contain.
    const message = error instanceof ScopeTokenError ? error.message : 'Invalid scope';
    return NextResponse.json({ error: message }, { status: 403 });
  }

  const tool = TOOLS[toolName];
  if (!tool) {
    return NextResponse.json(
      { error: `Unknown tool '${toolName}'`, available: listTools().map((entry) => entry.name) },
      { status: 404 },
    );
  }

  const meta = {
    tool: tool.name,
    startedAt,
    dryRun: true,
    workspaceId: scope.workspaceId,
    scopeJti: scope.jti,
  };

  const db = createAdminSupabase();

  try {
    const body = bodySchema.parse(await request.json().catch(() => ({})));

    // A read-only tool is never "dry": reporting dry_run on it would imply a
    // withheld side effect that does not exist.
    const dryRun = tool.mutating ? body.dry_run : false;
    meta.dryRun = dryRun;

    const parsed = tool.schema.safeParse(body.params);
    if (!parsed.success) {
      return NextResponse.json(
        failed(meta, `Invalid parameters: ${parsed.error.issues.map((issue) => issue.message).join('; ')}`),
        { status: 400 },
      );
    }

    const envelope = await tool.handler(parsed.data, { scope, db, dryRun, meta });

    // Every call is audited, including the ones that changed nothing. Section 17
    // asks for an immutable audit trail, and "what did the agent look at" is as
    // much a part of that as "what did it change".
    await db.rpc('write_audit', {
      p_org_id: scope.orgId,
      p_workspace_id: scope.workspaceId,
      p_action: `tool.${tool.name}`,
      p_entity_type: 'tool_call',
      p_entity_id: scope.jti,
      p_metadata: {
        status: envelope.status,
        dry_run: dryRun,
        mutating: tool.mutating,
        duration_ms: Date.now() - startedAt,
        warnings: envelope.warnings ?? [],
        acting_user_id: scope.userId,
      } as Json,
    });

    return NextResponse.json(envelope);
  } catch (error) {
    // Detail is logged, not returned: a Postgres error can carry column and
    // constraint names, and the agent relays what it receives into a chat the
    // customer reads.
    console.error(`[tools] ${toolName} failed:`, error);
    return NextResponse.json(failed(meta, 'Tool execution failed'), { status: 500 });
  }
}

/** Tool discovery, so the agent can be told what exists rather than guess. */
export async function GET(request: Request) {
  if (!bearerMatches(request.headers.get('authorization'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return NextResponse.json({ tools: listTools() });
}
