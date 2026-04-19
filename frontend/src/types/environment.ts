/**
 * v2 EnvironmentManifest types.
 *
 * Mirrors `geny_executor.EnvironmentManifest` and the backend
 * `service/environment/schemas.py` Pydantic models. Kept separate
 * from `types/index.ts` so the Environment Builder can evolve its
 * schema without dragging the rest of the type surface along.
 *
 * Source of truth on the backend side:
 *   - geny-executor: src/geny_executor/environment.py
 *   - Geny backend: backend/service/environment/schemas.py
 */

export interface EnvironmentMetadata {
  id: string;
  name: string;
  description: string;
  author?: string;
  tags: string[];
  created_at: string;
  updated_at: string;
  base_preset?: string;
}

export interface StageToolBinding {
  mode: 'inherit' | 'allowlist' | 'blocklist';
  patterns: string[];
}

export interface StageModelOverride {
  model?: string;
  system_prompt?: string;
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  [key: string]: unknown;
}

export interface StageManifestEntry {
  order: number;
  name: string;
  active: boolean;
  artifact: string;
  strategies: Record<string, string>;
  strategy_configs: Record<string, Record<string, unknown>>;
  config: Record<string, unknown>;
  tool_binding?: StageToolBinding | null;
  model_override?: StageModelOverride | null;
  chain_order: Record<string, string[]>;
}

export interface ToolsSnapshot {
  adhoc: Array<Record<string, unknown>>;
  mcp_servers: Array<Record<string, unknown>>;
  global_allowlist: string[];
  global_blocklist: string[];
}

export interface EnvironmentManifest {
  version: string;
  metadata: EnvironmentMetadata;
  model: Record<string, unknown>;
  pipeline: Record<string, unknown>;
  stages: StageManifestEntry[];
  tools?: ToolsSnapshot;
}

// ── Request/response shapes for the v2 endpoints ──────────────────

export type CreateEnvironmentMode = 'blank' | 'from_session' | 'from_preset';

export interface CreateEnvironmentPayload {
  mode: CreateEnvironmentMode;
  name: string;
  description?: string;
  tags?: string[];
  session_id?: string;
  preset_name?: string;
}

export interface UpdateEnvironmentPayload {
  name?: string;
  description?: string;
  tags?: string[];
}

export interface UpdateStageTemplatePayload {
  artifact?: string;
  strategies?: Record<string, string>;
  strategy_configs?: Record<string, Record<string, unknown>>;
  config?: Record<string, unknown>;
  tool_binding?: StageToolBinding | null;
  model_override?: StageModelOverride | null;
  chain_order?: Record<string, string[]>;
  active?: boolean;
}

export interface EnvironmentSummary {
  id: string;
  name: string;
  description: string;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface EnvironmentDetail extends EnvironmentSummary {
  manifest?: EnvironmentManifest | null;
  snapshot?: Record<string, unknown> | null;
}

export interface EnvironmentDiffResult {
  added: string[];
  removed: string[];
  changed: Array<{
    path: string;
    before: unknown;
    after: unknown;
  }>;
}

// ── Catalog (stage/artifact/strategy introspection) ──────────────

export interface ArtifactCapability {
  inputs: string[];
  outputs: string[];
  required_strategies: string[];
  optional_strategies: string[];
}

export interface ArtifactInfo {
  artifact_id: string;
  display_name: string;
  description: string;
  module: string;
  capabilities: ArtifactCapability;
  default_config: Record<string, unknown>;
  available_strategies: Record<string, string[]>;
}

export interface StageCatalogEntry {
  stage_order: number;
  stage_name: string;
  required: boolean;
  artifacts: ArtifactInfo[];
}

export interface CatalogResponse {
  version: string;
  stages: StageCatalogEntry[];
}
