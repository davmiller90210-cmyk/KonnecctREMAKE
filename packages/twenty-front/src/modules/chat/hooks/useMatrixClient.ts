import { useEffect, useRef } from 'react';
import { useAtom, useAtomValue } from 'jotai';
import { createClient, MatrixClient, ClientEvent } from 'matrix-js-sdk';

import { tokenPairState } from '@/auth/states/tokenPairState';
import {
  matrixSessionState,
  matrixSyncedState,
} from '@/chat/states/matrixSessionState';

const MATRIX_TOKEN_ENDPOINT = '/matrix/token';

/**
 * useMatrixClient
 *
 * The single hook responsible for bootstrapping the matrix-js-sdk connection.
 * It should be mounted once at the application root (inside AppRouterProviders
 * or a MatrixProvider wrapper) after the user is authenticated.
 *
 * Lifecycle:
 * 1. Watches the CRM auth token (tokenPairState). When the user logs in, it fires.
 * 2. Calls the CRM backend /api/matrix/token endpoint (authenticated with CRM JWT).
 * 3. Creates a MatrixClient from the returned session data.
 * 4. Calls client.startClient({ initialSyncLimit: 20 }) to begin background sync.
 * 5. Sets matrixSyncedState to true once the first sync completes.
 * 6. On CRM logout (tokenPair becomes null), stops the client and clears state.
 *
 * The MatrixClient reference is stored in a useRef so it persists across renders
 * without triggering re-renders. Components that need to use the client directly
 * should import this hook and call client.current?.
 */
export const useMatrixClient = (): React.MutableRefObject<MatrixClient | null> => {
  const tokenPair = useAtomValue(tokenPairState.atom);
  const [, setMatrixSession] = useAtom(matrixSessionState);
  const [, setMatrixSynced] = useAtom(matrixSyncedState);
  const clientRef = useRef<MatrixClient | null>(null);

  useEffect(() => {
    if (!tokenPair?.accessToken) {
      // User has logged out - stop and clean up the Matrix client
      if (clientRef.current) {
        clientRef.current.stopClient();
        clientRef.current = null;
      }
      setMatrixSession(null);
      setMatrixSynced(false);
      return;
    }

    // Don't re-initialize if we already have a running client
    if (clientRef.current) return;

    let cancelled = false;

    const initializeMatrix = async () => {
      try {
        // Step 1: Fetch Matrix session from CRM backend (server provisions account if needed)
        const response = await fetch(MATRIX_TOKEN_ENDPOINT, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${tokenPair.accessToken}`,
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok || cancelled) return;

        const session = await response.json();
        if (cancelled) return;

        setMatrixSession(session);

        // Step 2: Create the MatrixClient with the server-issued access token
        const client = createClient({
          baseUrl: session.homeserverUrl,
          accessToken: session.accessToken,
          userId: session.userId,
          deviceId: session.deviceId,
          // No store — keeps the client stateless across refreshes
          // which forces a clean re-sync from the homeserver each session.
          // A future phase can add IndexedDB storage for offline support.
        });

        clientRef.current = client;

        // Step 3: Listen for the first sync to mark the client as ready
        client.once(ClientEvent.Sync, (state) => {
          if (state === 'PREPARED' && !cancelled) {
            setMatrixSynced(true);
          }
        });

        // Step 4: Start the background sync loop
        await client.startClient({ initialSyncLimit: 20 });
      } catch (error) {
        // Silently fail — the CRM remains usable even if Matrix is unavailable.
        // The CommunicationHub will show a reconnecting state instead of crashing.
        console.warn('[Matrix] Failed to initialize Matrix client:', error);
      }
    };

    initializeMatrix();

    return () => {
      cancelled = true;
      if (clientRef.current) {
        clientRef.current.stopClient();
        clientRef.current = null;
      }
      setMatrixSynced(false);
    };
  }, [tokenPair?.accessToken, setMatrixSession, setMatrixSynced]);

  return clientRef;
};
