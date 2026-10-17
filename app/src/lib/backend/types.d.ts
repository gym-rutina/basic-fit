/**
 * The client-side seam interface. The WIRE types (what travels over HTTP) are
 * the contract's, imported from contract/types.d.ts, never copied here: the
 * contract is the single source of truth and this file cannot drift from it.
 */

import type {
  Account,
  BackupEnvelope,
  CreditBalance,
  CreditPack,
  GenerationIntake,
  GenerationJob,
  HostedUrl,
  Session,
  Subscription,
  SubscriptionCheckoutRequest,
  SyncSnapshot,
  WithdrawalAcknowledgement,
  WithdrawalRequest,
} from '../../../../contract/types';

export type {
  ContractErrorCode,
  Account,
  Session,
  CreditPack,
  CreditBalance,
  GenerationIntake,
  GenerationJob,
  BackupEnvelope,
  SyncSnapshot,
  Subscription,
} from '../../../../contract/types';

/**
 * The single interface every screen depends on. LocalBackend and HttpBackend
 * both implement it. Methods reject with BackendError (errors.js): never a raw
 * fetch rejection, never an HTTP status.
 *
 * It deliberately has NO club-equipment method: anonymous reports travel
 * through reportOutbox / reportFlush, the one queue and the one transport.
 */
export interface BackendClient {
  /** true only when a real server is configured. */
  readonly isRemote: boolean;

  // account
  getSession(): Session | null;
  signUp(input: { email: string; password: string; locale?: string }): Promise<Session>;
  signIn(input: { email: string; password: string }): Promise<Session>;
  signOut(): Promise<void>;
  getAccount(): Promise<Account>;
  deleteAccount(): Promise<{ deletedWithin: string }>;

  // credits
  getCreditPacks(locale: string): Promise<CreditPack[]>;
  getCreditBalance(): Promise<CreditBalance>;
  startCheckout(input: { packId: string; locale?: string }): Promise<{ checkoutUrl: string; expiresAt: string }>;

  // subscription (draft)
  getSubscription(): Promise<Subscription>;
  startSubscriptionCheckout(input: SubscriptionCheckoutRequest): Promise<HostedUrl>;
  openSubscriptionPortal(): Promise<HostedUrl>;

  // withdrawals (draft)
  submitWithdrawal(input: WithdrawalRequest): Promise<WithdrawalAcknowledgement>;

  // generation
  startGeneration(intake: GenerationIntake): Promise<GenerationJob>;
  getGeneration(jobId: string): Promise<GenerationJob>;

  // sync
  setSyncEnabled(enabled: boolean): Promise<{ enabled: boolean }>;
  fetchSnapshot(): Promise<SyncSnapshot>;
  pushSnapshot(envelope: BackupEnvelope, ifMatch: string): Promise<{ revision: string; storedAt: string }>;
}
