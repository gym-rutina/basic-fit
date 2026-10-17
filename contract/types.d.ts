/**
 * TypeScript mirror of openapi.yaml (contract v0.3.0). Hand-maintained; keep in
 * step with the contract SemVer (see README.md). These are the WIRE shapes:
 * what travels between the client and the backend. The client-side
 * `BackendClient` interface that returns them lives in the client repo, in
 * app/src/lib/backend/types.d.ts.
 */

/**
 * The closed error-code set (errors.md is the authority). Keep this union,
 * the errors.md table and the openapi.yaml `Error.code` enum identical; the
 * only code that is not on the wire is the client-only one, last in the list.
 */
export type ContractErrorCode =
  | 'invalid_request'
  | 'unknown_tenant'
  | 'invalid_credentials'
  | 'email_in_use'
  | 'unauthorized'
  | 'session_expired'
  | 'no_credits'
  | 'plus_required'
  | 'unknown_pack'
  | 'invalid_intake'
  | 'generation_failed'
  | 'rate_limited'
  | 'daily_ceiling_reached'
  | 'sync_not_enabled'
  | 'no_snapshot'
  | 'revision_mismatch'
  | 'snapshot_too_large'
  | 'contract_version_unsupported'
  | 'health_consent_required'
  | 'consent_required'
  | 'not_implemented'
  | 'provider_unavailable'
  | 'internal'
  | 'backend_unavailable';

/** Every non-2xx response body. */
export interface ContractError {
  code: ContractErrorCode;
  message: string;
  retryable?: boolean;
  details?: Record<string, unknown>;
}

export interface Account {
  id: string;
  email: string;
  credits: number;
  syncEnabled: boolean;
  createdAt: string;
}

export interface Session {
  token: string;
  expiresAt: string;
  account: Account;
}

export interface CreditPack {
  packId: string;
  credits: number;
  priceDisplay: string;
  currency: string;
}

export interface CreditLedgerEntry {
  at: string;
  delta: number;
  reason: 'purchase' | 'generation_spend' | 'generation_refund' | 'adjustment';
  generationId?: string;
}

export interface CreditBalance {
  credits: number;
  ledger: CreditLedgerEntry[];
}

/** Express consent to immediate supply of digital content. */
export interface ConsentRecord {
  version: string;
  accepted: boolean;
}

/** A provider-hosted page (checkout, customer portal) the client opens. */
export interface HostedUrl {
  url: string;
  expiresAt?: string;
}

/** Draft shape: refined by the subscription feature. */
export interface Subscription {
  status: 'none' | 'active' | 'past_due' | 'canceled';
  currentPeriodEnd?: string | null;
  cancelAtPeriodEnd?: boolean;
}

export interface SubscriptionCheckoutRequest {
  plan: 'plus' | 'pack';
  locale: string;
  consent: ConsentRecord;
}

/** Draft shape: refined by the withdrawal feature. */
export interface WithdrawalRequest {
  purchaseRef: string;
  declaration: string;
}

export interface WithdrawalAcknowledgement {
  withdrawalId: string;
  purchaseRef: string;
  declaration: string;
  declaredAt: string;
}

/** GET /v1/tenant/config. Public fields only; never a price id or a secret. */
export interface TenantConfig {
  tenantId: string;
  displayName: string;
  equipmentCatalogueVersion: string;
  generationOutputLocales: string[];
  plans: {
    plus: { creditsPerPeriod: number; subscriptionCreditCap: number };
    pack: { credits: number };
  };
}

/** GET /v1/health. The catalogue version is null without a valid tenant. */
export interface Health {
  status: 'ok';
  contractVersion: string;
  equipmentCatalogueVersion?: string | null;
}

export type GoalId = 'strength' | 'hypertrophy' | 'endurance' | 'general_fitness' | 'weight_loss';

export interface GenerationIntake {
  goals: GoalId[];
  experience: 'beginner' | 'intermediate' | 'advanced';
  daysPerWeek: number;
  sessionMinutes: number;
  equipmentContext: { clubId: string } | { fullCatalogue: true };
  /** Free-text health data. Only sent when healthDataConsent is true. */
  constraintsText?: string;
  healthDataConsent?: boolean;
  /** Optional prior history in the LLM-export shape. */
  history?: Record<string, unknown>;
  outputLocale: string;
}

export interface GenerationJob {
  jobId: string;
  status: 'queued' | 'running' | 'succeeded' | 'failed';
  createdAt: string;
  attempts?: number;
  progressHint?: 'composing_prompt' | 'awaiting_model' | 'validating' | 'retrying' | 'finalising';
  result?: {
    /** Validated rutina, identical in shape to an imported one. */
    rutina: Record<string, unknown>;
    equipmentCatalogueVersion: string;
    generatedAt: string;
  };
  error?: { code: ContractErrorCode; message: string; details?: Record<string, unknown> };
}

/** The full-data-backup envelope, verbatim. */
export interface BackupEnvelope {
  formatVersion: number;
  appVersion: string;
  exportedAt: string;
  data: {
    rutinas: Array<{ id: string; rutina: Record<string, unknown>; importedAt: string; seq: number }>;
    activeRutinaId: string | null;
    sessions: Array<Record<string, unknown>>;
    lastWeights: Array<Record<string, unknown>>;
    settings: Record<string, unknown>;
  };
}

export interface SyncSnapshot extends BackupEnvelope {
  revision: string;
  storedAt: string;
}

/**
 * POST /v1/club-equipment/reports. Exactly these six fields and nothing else:
 * the collector rejects any extra field and persists no IP address, user agent
 * or fingerprint.
 */
export interface ClubEquipmentReport {
  reportId: string;
  clubId: string;
  equipmentId: string;
  signal: 'present' | 'absent';
  method: 'session' | 'catalog';
  reportedAt: string;
}
