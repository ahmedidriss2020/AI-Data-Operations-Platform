import 'server-only';

import { z } from 'zod';

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';
import type { ToolScope } from '@/lib/tool-layer/scope-token';
import { type EnvelopeMeta, type ToolEnvelope, notImplemented, ok } from '@/lib/tool-layer/envelope';

export type ToolContext = {
  scope: ToolScope;
  db: SupabaseClient<Database>;
  dryRun: boolean;
  meta: EnvelopeMeta;
};

export type ToolDefinition<S extends z.ZodTypeAny = z.ZodTypeAny> = {
  name: string;
  summary: string;
  /** Mutating tools are the ones dry_run actually means something for. */
  mutating: boolean;
  schema: S;
  handler: (params: z.infer<S>, context: ToolContext) => Promise<ToolEnvelope<unknown>>;
};

function define<S extends z.ZodTypeAny>(definition: ToolDefinition<S>): ToolDefinition {
  return definition as unknown as ToolDefinition;
}

/**
 * A tool whose contract is fixed but whose compute layer (the Python parser,
 * DuckDB, Polars) does not exist in this repository yet.
 *
 * Registering it as a stub rather than omitting it is deliberate: the agent
 * discovers the real contract and gets an honest `not_implemented`, instead of
 * a 404 that reads like a bug or -- far worse -- a fabricated answer.
 */
function pending<S extends z.ZodTypeAny>(
  name: string,
  summary: string,
  schema: S,
  needs: string,
  mutating = false,
): ToolDefinition {
  return define({
    name,
    summary,
    mutating,
    schema,
    handler: async (_params, { meta }) => notImplemented(meta, needs),
  });
}

const datasetVersionRef = z.object({ dataset_version_id: z.string().uuid() });

/* ---------------------------------------------------------------------------
   Implemented tools -- everything here answers from data we actually hold.
   --------------------------------------------------------------------------- */

/**
 * Match an incoming dataset to a recipe by source_signature (section 9).
 *
 * Scoped by the token's workspace, not by any parameter: two clients of the
 * same firm can export from the same accounting package and therefore share a
 * signature, and a recipe must never leak across that boundary.
 */
const matchRecipe = define({
  name: 'match_recipe',
  summary: 'Find candidate recipes for a dataset by source signature.',
  mutating: false,
  schema: z.object({
    dataset_id: z.string().uuid().optional(),
    source_signature: z.string().min(1).optional(),
  }),
  handler: async (params, { db, scope, meta }) => {
    let signature = params.source_signature ?? null;

    if (!signature && params.dataset_id) {
      const { data } = await db
        .from('datasets')
        .select('source_signature')
        .eq('id', params.dataset_id)
        .eq('workspace_id', scope.workspaceId)
        .maybeSingle();
      signature = data?.source_signature ?? null;
    }

    if (!signature) {
      return ok(meta, { candidates: [] }, {
        warnings: [
          'No source signature available. The workbook parser assigns it; until then a recipe cannot be auto-matched.',
        ],
      });
    }

    const { data: recipes, error } = await db
      .from('cleaning_recipes')
      .select('id, name, source_signature, dataset_id, created_at')
      .eq('workspace_id', scope.workspaceId)
      .eq('source_signature', signature);

    if (error) throw new Error(error.message);

    const candidates = await Promise.all(
      (recipes ?? []).map(async (recipe) => {
        const { data: version } = await db
          .from('recipe_versions')
          .select('id, version_no, created_at')
          .eq('recipe_id', recipe.id)
          .order('version_no', { ascending: false })
          .limit(1)
          .maybeSingle();

        return {
          recipe_id: recipe.id,
          name: recipe.name,
          current_version_id: version?.id ?? null,
          current_version_no: version?.version_no ?? null,
        };
      }),
    );

    return ok(meta, { candidates }, {
      evidence: { matched_on: 'source_signature', signature, workspace_id: scope.workspaceId },
    });
  },
});

/**
 * Lineage and shape of one dataset version.
 *
 * Column-level detail deliberately is not invented here: the parser is what
 * knows column names and types, and dataset_versions stores only a column_hash.
 * Reporting the hash and saying so is honest; guessing columns would not be.
 */
const inspectSchema = define({
  name: 'inspect_schema',
  summary: 'Lineage, row count and column hash for a dataset version.',
  mutating: false,
  schema: datasetVersionRef,
  handler: async (params, { db, scope, meta }) => {
    const { data: version, error } = await db
      .from('dataset_versions')
      .select('id, dataset_id, parent_version_id, version_no, kind, row_count, column_hash, parquet_path, created_at, datasets!inner(workspace_id, name)')
      .eq('id', params.dataset_version_id)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!version) return ok(meta, null, { warnings: ['Dataset version not found'] });

    // The service-role client bypasses RLS, so ownership is re-checked here.
    // This is the section 8 rule -- authorize on every operation -- and it is
    // the only check standing between a mistyped id and another firm's data.
    const owner = (version.datasets as unknown as { workspace_id: string }).workspace_id;
    if (owner !== scope.workspaceId) {
      return ok(meta, null, { warnings: ['Dataset version not found'] });
    }

    return ok(meta, {
      dataset_version_id: version.id,
      dataset_id: version.dataset_id,
      version_no: version.version_no,
      parent_version_id: version.parent_version_id,
      kind: version.kind,
      row_count: version.row_count,
      column_hash: version.column_hash,
      has_parquet: Boolean(version.parquet_path),
    }, {
      warnings: version.column_hash
        ? undefined
        : ['Column-level schema is unavailable until the workbook parser has run on this version.'],
      evidence: { source: 'dataset_versions', dataset_version_id: version.id },
    });
  },
});

/** Metadata-level diff of two versions in the same lineage. */
const diffVersions = define({
  name: 'diff_versions',
  summary: 'Compare row count, column hash and lineage between two dataset versions.',
  mutating: false,
  schema: z.object({
    version_a: z.string().uuid(),
    version_b: z.string().uuid(),
  }),
  handler: async (params, { db, scope, meta }) => {
    const { data: rows, error } = await db
      .from('dataset_versions')
      .select('id, dataset_id, version_no, row_count, column_hash, created_at, datasets!inner(workspace_id)')
      .in('id', [params.version_a, params.version_b]);

    if (error) throw new Error(error.message);

    const mine = (rows ?? []).filter(
      (row) => (row.datasets as unknown as { workspace_id: string }).workspace_id === scope.workspaceId,
    );

    if (mine.length !== 2) {
      return ok(meta, null, { warnings: ['One or both dataset versions were not found in this workspace'] });
    }

    const a = mine.find((row) => row.id === params.version_a)!;
    const b = mine.find((row) => row.id === params.version_b)!;

    const rowDelta =
      a.row_count !== null && b.row_count !== null ? Number(b.row_count) - Number(a.row_count) : null;

    return ok(meta, {
      row_count_a: a.row_count,
      row_count_b: b.row_count,
      row_count_delta: rowDelta,
      column_hash_changed: a.column_hash !== b.column_hash,
      same_dataset: a.dataset_id === b.dataset_id,
    }, {
      warnings: a.dataset_id === b.dataset_id
        ? undefined
        : ['These versions belong to different datasets; a diff across lineages is rarely meaningful.'],
      evidence: { version_a: a.id, version_b: b.id },
    });
  },
});

/**
 * Post-run invariants (section 10).
 *
 * Only the checks the metadata can genuinely support run here -- row-count
 * drift against the trailing average, and the reporting-period check when
 * dates are known. The distribution and totals checks need the data itself and
 * are reported as unevaluated rather than quietly passed. A run whose
 * invariants were skipped must never read as having passed them.
 */
const checkInvariants = define({
  name: 'check_invariants',
  summary: 'Evaluate post-run invariants for a recipe run.',
  mutating: false,
  schema: z.object({
    run_id: z.string().uuid(),
    row_count_tolerance_pct: z.number().min(0).max(100).default(20),
  }),
  handler: async (params, { db, scope, meta }) => {
    const { data: run, error } = await db
      .from('recipe_runs')
      .select('id, dataset_version_in, rows_processed, recipe_version_id')
      .eq('id', params.run_id)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!run) return ok(meta, null, { warnings: ['Run not found'] });

    const { data: scopeRow } = await db.rpc('workspace_of_run', { p_run_id: run.id });
    if (scopeRow !== scope.workspaceId) {
      return ok(meta, null, { warnings: ['Run not found'] });
    }

    const { data: version } = await db
      .from('dataset_versions')
      .select('dataset_id, row_count')
      .eq('id', run.dataset_version_in)
      .maybeSingle();

    const checks: Array<{ name: string; status: 'passed' | 'failed' | 'unevaluated'; detail: string }> = [];

    // Row-count drift against the trailing average of this dataset's history.
    if (version?.dataset_id) {
      const { data: history } = await db
        .from('dataset_versions')
        .select('row_count')
        .eq('dataset_id', version.dataset_id)
        .not('row_count', 'is', null)
        .order('version_no', { ascending: false })
        .limit(4);

      const priors = (history ?? []).slice(1).map((row) => Number(row.row_count));
      const current = version.row_count === null ? null : Number(version.row_count);

      if (priors.length === 0 || current === null) {
        checks.push({
          name: 'row_count_drift',
          status: 'unevaluated',
          detail: 'No prior versions with a recorded row count to compare against.',
        });
      } else {
        const average = priors.reduce((sum, value) => sum + value, 0) / priors.length;
        const driftPct = average === 0 ? 0 : Math.abs((current - average) / average) * 100;
        checks.push({
          name: 'row_count_drift',
          status: driftPct <= params.row_count_tolerance_pct ? 'passed' : 'failed',
          detail: `${current} rows vs trailing average ${average.toFixed(0)} (${driftPct.toFixed(1)}% drift, tolerance ${params.row_count_tolerance_pct}%)`,
        });
      }
    }

    for (const [name, needs] of [
      ['financial_total_tolerance', 'totals from the cleaned dataset'],
      ['column_distribution_drift', 'column statistics from the parser'],
      ['reporting_period_bounds', 'parsed date columns'],
      ['stated_total_reconciliation', 'the source totals row'],
    ] as const) {
      checks.push({ name, status: 'unevaluated', detail: `Requires ${needs}.` });
    }

    const failedChecks = checks.filter((check) => check.status === 'failed');
    const unevaluated = checks.filter((check) => check.status === 'unevaluated');

    return ok(meta, {
      run_id: run.id,
      // Deliberately not 'passed': unevaluated checks are not passes, and a
      // caller that treats them as such would be reporting a false all-clear.
      overall: failedChecks.length > 0 ? 'failed' : unevaluated.length > 0 ? 'incomplete' : 'passed',
      checks,
    }, {
      warnings: unevaluated.length > 0
        ? [`${unevaluated.length} of ${checks.length} invariants could not be evaluated without the compute layer.`]
        : undefined,
      evidence: { run_id: run.id, evaluated: checks.length - unevaluated.length },
    });
  },
});

/** Provenance for a displayed number (section 10). */
const explainNumber = define({
  name: 'explain_number',
  summary: 'Return the provenance tree behind a previously computed figure.',
  mutating: false,
  schema: z.object({ analysis_run_id: z.string().uuid() }),
  handler: async (params, { db, scope, meta }) => {
    const { data: run, error } = await db
      .from('analysis_runs')
      .select('id, workspace_id, dataset_version_id, question, sql_executed, result_json, source_row_ids, created_at')
      .eq('id', params.analysis_run_id)
      .eq('workspace_id', scope.workspaceId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!run) return ok(meta, null, { warnings: ['Analysis run not found'] });

    const rowIds = Array.isArray(run.source_row_ids) ? run.source_row_ids : [];

    return ok(meta, {
      analysis_run_id: run.id,
      question: run.question,
      dataset_version_id: run.dataset_version_id,
      sql_executed: run.sql_executed,
      result: run.result_json,
      source_row_count: rowIds.length,
    }, {
      evidence: {
        dataset_version_id: run.dataset_version_id,
        sql_executed: run.sql_executed,
        source_row_ids: rowIds.slice(0, 500),
        truncated: rowIds.length > 500,
      },
    });
  },
});

/* --- Mapping tables (section 9). Not in the section 7 list, but MVP
       criterion 9 -- "human resolutions update mapping tables" -- cannot be
       met without a way to read and write them. --------------------------- */

const lookupMappings = define({
  name: 'lookup_mappings',
  summary: 'Look up workspace mapping entries by kind and keys.',
  mutating: false,
  schema: z.object({
    kind: z.string().min(1),
    keys: z.array(z.string().min(1)).max(500).default([]),
  }),
  handler: async (params, { db, scope, meta }) => {
    let query = db
      .from('mapping_entries')
      .select('lookup_key, mapped_value, metadata, hit_count')
      .eq('workspace_id', scope.workspaceId)
      .eq('kind', params.kind);

    if (params.keys.length > 0) query = query.in('lookup_key', params.keys);

    const { data, error } = await query.limit(500);
    if (error) throw new Error(error.message);

    return ok(meta, { entries: data ?? [] }, {
      evidence: { workspace_id: scope.workspaceId, kind: params.kind, returned: data?.length ?? 0 },
    });
  },
});

/**
 * Write back a resolution so the same ambiguity does not recur (section 9).
 *
 * Mutating, so it honours dry_run -- and dry_run defaults to true at the route,
 * meaning a caller who omits the flag gets a preview of the write rather than
 * the write itself.
 */
const recordMapping = define({
  name: 'record_mapping',
  summary: 'Record a human resolution into the workspace mapping table.',
  mutating: true,
  schema: z.object({
    kind: z.string().min(1),
    lookup_key: z.string().min(1),
    mapped_value: z.string().min(1),
    metadata: z.record(z.string(), z.unknown()).default({}),
    learned_from_run_id: z.string().uuid().nullish(),
  }),
  handler: async (params, { db, scope, dryRun, meta }) => {
    const { data: existing } = await db
      .from('mapping_entries')
      .select('id, mapped_value')
      .eq('workspace_id', scope.workspaceId)
      .eq('kind', params.kind)
      .eq('lookup_key', params.lookup_key)
      .maybeSingle();

    const wouldChange = !existing || existing.mapped_value !== params.mapped_value;

    if (dryRun) {
      return ok(meta, {
        would_write: wouldChange,
        action: existing ? 'update' : 'insert',
        previous_value: existing?.mapped_value ?? null,
        new_value: params.mapped_value,
      }, {
        evidence: { dry_run: true, workspace_id: scope.workspaceId },
      });
    }

    const { error } = await db.from('mapping_entries').upsert(
      {
        workspace_id: scope.workspaceId,
        kind: params.kind,
        lookup_key: params.lookup_key,
        mapped_value: params.mapped_value,
        metadata: params.metadata as never,
        learned_from_run_id: params.learned_from_run_id ?? null,
        confirmed_by: scope.userId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'workspace_id,kind,lookup_key' },
    );

    if (error) throw new Error(error.message);

    return ok(meta, {
      written: true,
      action: existing ? 'update' : 'insert',
      previous_value: existing?.mapped_value ?? null,
      new_value: params.mapped_value,
    }, {
      evidence: { workspace_id: scope.workspaceId, confirmed_by: scope.userId },
    });
  },
});

/* ---------------------------------------------------------------------------
   Contract-complete stubs. The signature is real; the compute layer is not
   built in this repository yet.
   --------------------------------------------------------------------------- */

const NEEDS_PARSER = 'the Python workbook parser (services/parser)';
const NEEDS_COMPUTE = 'the DuckDB/Polars compute layer';

const stubs = [
  pending('parse_workbook', 'Interpret a messy workbook into a structured table.',
    z.object({ file_id: z.string().uuid() }), NEEDS_PARSER),
  pending('profile_dataset', 'Column statistics and type inference for a dataset version.',
    datasetVersionRef, NEEDS_COMPUTE),
  pending('apply_recipe', 'Execute a recipe version against a dataset version.',
    z.object({
      dataset_version_id: z.string().uuid(),
      recipe_version_id: z.string().uuid(),
    }), NEEDS_COMPUTE, true),
  pending('detect_duplicates', 'Find duplicate rows by key.',
    datasetVersionRef.extend({ keys: z.array(z.string()).default([]) }), NEEDS_COMPUTE),
  pending('detect_anomalies', 'Find anomalous values in a metric.',
    datasetVersionRef.extend({ metric: z.string() }), NEEDS_COMPUTE),
  pending('normalize_values', 'Apply normalization rules to a column.',
    datasetVersionRef.extend({ column: z.string(), rules: z.array(z.unknown()).default([]) }),
    NEEDS_COMPUTE, true),
  pending('validate_dataset', 'Run a rule set against a dataset version.',
    datasetVersionRef.extend({ rule_set: z.string() }), NEEDS_COMPUTE),
  pending('reconcile_sources', 'Reconcile two sources under matching rules.',
    z.object({
      source_a: z.string().uuid(),
      source_b: z.string().uuid(),
      matching_rules: z.array(z.unknown()).default([]),
    }), NEEDS_COMPUTE),
  pending('query_dataset', 'Run a structured query against a dataset version.',
    datasetVersionRef.extend({ structured_query: z.record(z.string(), z.unknown()) }), NEEDS_COMPUTE),
  pending('compare_periods', 'Compare a metric across two periods.',
    datasetVersionRef.extend({
      metric: z.string(),
      period_a: z.string(),
      period_b: z.string(),
    }), NEEDS_COMPUTE),
  pending('generate_chart', 'Render a chart from a dataset version.',
    datasetVersionRef.extend({ chart_spec: z.record(z.string(), z.unknown()) }), NEEDS_COMPUTE),
  pending('generate_report', 'Generate a report from a dataset version.',
    datasetVersionRef.extend({ report_type: z.string() }), NEEDS_COMPUTE),
];

export const TOOLS: Record<string, ToolDefinition> = Object.fromEntries(
  [
    matchRecipe,
    inspectSchema,
    diffVersions,
    checkInvariants,
    explainNumber,
    lookupMappings,
    recordMapping,
    ...stubs,
  ].map((tool) => [tool.name, tool]),
);

export function listTools() {
  return Object.values(TOOLS).map((tool) => ({
    name: tool.name,
    summary: tool.summary,
    mutating: tool.mutating,
  }));
}
