/**
 * The backend that ships TODAY: no server, no account, no network, no storage
 * writes. It IS the offline app. Every account / credit / subscription /
 * withdrawal / generation / sync method rejects with `backend_unavailable`,
 * which callers treat as "act as the offline free app" — never an error screen.
 *
 * It has NO club-equipment method. The anonymous report path is
 * useClubExclusions → reportOutbox → reportFlush and stays the only queue and
 * the only transport; a second entry point here would be a second queue.
 *
 * Reference implementation of BackendClient (./types.d.ts) and what
 * createBackend() returns whenever VITE_BACKEND_URL is unset or invalid.
 */

import { BackendError } from './errors.js';

const unavailable = () =>
  Promise.reject(new BackendError('backend_unavailable', 'The account features need a connection. The app works fully offline without them.'));

/** @implements {import('./types').BackendClient} */
export class LocalBackend {
  get isRemote() {
    return false;
  }

  // account
  getSession() {
    return null;
  }
  signUp() {
    return unavailable();
  }
  signIn() {
    return unavailable();
  }
  /** Already signed out: idempotent, resolves. */
  signOut() {
    return Promise.resolve();
  }
  getAccount() {
    return unavailable();
  }
  deleteAccount() {
    return unavailable();
  }

  // credits
  getCreditPacks() {
    return unavailable();
  }
  getCreditBalance() {
    return unavailable();
  }
  startCheckout() {
    return unavailable();
  }

  // subscription
  getSubscription() {
    return unavailable();
  }
  startSubscriptionCheckout() {
    return unavailable();
  }
  openSubscriptionPortal() {
    return unavailable();
  }

  // withdrawals
  submitWithdrawal() {
    return unavailable();
  }

  // generation
  startGeneration() {
    return unavailable();
  }
  getGeneration() {
    return unavailable();
  }

  // sync
  setSyncEnabled() {
    return unavailable();
  }
  fetchSnapshot() {
    return unavailable();
  }
  pushSnapshot() {
    return unavailable();
  }
}
