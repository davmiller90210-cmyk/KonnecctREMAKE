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
 * Bootstraps the Matrix client connection.
 * Resolves infinite loading by adding visibility into every step.
 */
export const useMatrixClient = (): React.MutableRefObject<MatrixClient | null> => {
  const tokenPair = useAtomValue(tokenPairState.atom);
  const [, setMatrixSession] = useAtom(matrixSessionState);
  const [, setMatrixSynced] = useAtom(matrixSyncedState);
  const clientRef = useRef<MatrixClient | null>(null);

  useEffect(() => {
    console.log('[KONNECCT-MATRIX] Hook effect triggered. Token exists:', !!tokenPair?.accessToken);
    
    if (!tokenPair?.accessToken) {
      if (clientRef.current) {
        console.log('[KONNECCT-MATRIX] Cleaning up client due to missing token');
        clientRef.current.stopClient();
        clientRef.current = null;
      }
      setMatrixSession(null);
      setMatrixSynced(false);
      return;
    }

    if (clientRef.current) {
      console.log('[KONNECCT-MATRIX] Client already initialized, skipping...');
      return;
    }

    let cancelled = false;

    const initializeMatrix = async () => {
      console.log('[KONNECCT-MATRIX] 🏁 Starting initialization sequence...');
      try {
        console.log('[KONNECCT-MATRIX] 🔑 Step 1: Fetching session from', MATRIX_TOKEN_ENDPOINT);
        const response = await fetch(MATRIX_TOKEN_ENDPOINT, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${tokenPair.accessToken}`,
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`[KONNECCT-MATRIX] ❌ Server returned error ${response.status}:`, errorText);
          return;
        }

        if (cancelled) return;

        const session = await response.json();
        console.log('[KONNECCT-MATRIX] ✅ Session obtained:', session);
        setMatrixSession(session);

        console.log('[KONNECCT-MATRIX] 🏗️ Step 2: Instantiating client for', session.homeserverUrl);
        const client = createClient({
          baseUrl: session.homeserverUrl,
          accessToken: session.accessToken,
          userId: session.userId,
          deviceId: session.deviceId,
        });

        clientRef.current = client;

        console.log('[KONNECCT-MATRIX] 👂 Step 3: Waiting for PREPARED sync state...');
        client.once(ClientEvent.Sync, (state) => {
          console.log('[KONNECCT-MATRIX] 🔄 Initial sync state update:', state);
          if (state === 'PREPARED' && !cancelled) {
            console.log('[KONNECCT-MATRIX] ✨ Client is SYNCED and Ready');
            setMatrixSynced(true);
          }
        });

        console.log('[KONNECCT-MATRIX] 🚀 Step 4: Starting background sync loop...');
        await client.startClient({ initialSyncLimit: 20 });
        console.log('[KONNECCT-MATRIX] ✅ startClient() promise resolved successfully');

      } catch (error) {
        console.error('[KONNECCT-MATRIX] 💥 CRITICAL ERROR:', error);
      }
    };

    initializeMatrix();

    return () => {
      console.log('[KONNECCT-MATRIX] Hook cleanup called');
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
