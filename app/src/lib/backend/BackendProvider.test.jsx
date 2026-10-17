import { describe, it, expect, vi, afterEach } from 'vitest';
import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { BackendProvider, useBackend } from './BackendProvider.jsx';
import { LocalBackend } from './LocalBackend.js';

/**
 * backend-bootstrap AC11 / AC16 (tech-plan.md §2 D5/D6) — React access to the
 * seam. Mirrors I18nProvider: a working default (LocalBackend), so a component
 * rendered WITHOUT the provider still behaves as the offline app. The provider
 * adds no UI, writes nothing and makes no request.
 */

afterEach(() => vi.restoreAllMocks());

function Probe() {
  const { client, session, isRemote } = useBackend();
  return (
    <p data-testid="probe">
      {client.constructor.name}|{String(isRemote)}|{session ? session.token : 'none'}
    </p>
  );
}

describe('useBackend', () => {
  it('outside a provider it still yields the offline LocalBackend (no crash)', () => {
    render(<Probe />);
    expect(screen.getByTestId('probe')).toHaveTextContent('LocalBackend|false|none');
  });

  it('inside a provider it uses createBackend() — LocalBackend while VITE_BACKEND_URL is unset', () => {
    render(
      <BackendProvider>
        <Probe />
      </BackendProvider>
    );
    expect(screen.getByTestId('probe')).toHaveTextContent('LocalBackend|false|none');
  });

  it('uses an injected client and its session', () => {
    const client = { isRemote: true, getSession: () => ({ token: 'abc' }) };
    render(
      <BackendProvider client={client}>
        <Probe />
      </BackendProvider>
    );
    expect(screen.getByTestId('probe')).toHaveTextContent('Object|true|abc');
  });

  it('refreshSession re-reads the client session', () => {
    let session = null;
    const client = { isRemote: true, getSession: () => session };
    let api;
    function Grab() {
      api = useBackend();
      return <p data-testid="s">{api.session ? api.session.token : 'none'}</p>;
    }
    render(
      <BackendProvider client={client}>
        <Grab />
      </BackendProvider>
    );
    expect(screen.getByTestId('s')).toHaveTextContent('none');
    session = { token: 'later' };
    act(() => api.refreshSession());
    expect(screen.getByTestId('s')).toHaveTextContent('later');
  });
});

describe('the provider is inert (AC16)', () => {
  it('renders exactly its children — no wrapper element, no UI', () => {
    const { container } = render(
      <BackendProvider>
        <div id="only-child">hi</div>
      </BackendProvider>
    );
    expect(container.innerHTML).toBe('<div id="only-child">hi</div>');
  });

  it('writes nothing to storage and makes no network request on mount', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    render(
      <BackendProvider>
        <Probe />
      </BackendProvider>
    );
    expect(setItem).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('the default client really is a LocalBackend instance', () => {
    let client;
    function Grab() {
      client = useBackend().client;
      return null;
    }
    render(
      <BackendProvider>
        <Grab />
      </BackendProvider>
    );
    expect(client).toBeInstanceOf(LocalBackend);
  });
});
