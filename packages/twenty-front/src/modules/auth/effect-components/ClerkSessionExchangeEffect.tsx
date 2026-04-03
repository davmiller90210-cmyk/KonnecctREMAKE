import { useAuth as useClerkAuth } from '@clerk/clerk-react';
import { useEffect, useRef } from 'react';

import { clerkExchangeErrorState } from '@/auth/states/clerkExchangeErrorState';
import { tokenPairState } from '@/auth/states/tokenPairState';
import { useLoadCurrentUser } from '@/users/hooks/useLoadCurrentUser';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import { useSetAtomState } from '@/ui/utilities/state/jotai/hooks/useSetAtomState';
import { type AuthTokenPair } from '~/generated-metadata/graphql';

const EXCHANGE_TIMEOUT_MS = 45_000;

export const ClerkSessionExchangeEffect = () => {
  const { isLoaded, isSignedIn, getToken, orgId } = useClerkAuth();
  const tokenPair = useAtomStateValue(tokenPairState);
  const setTokenPair = useSetAtomState(tokenPairState);
  const setExchangeError = useSetAtomState(clerkExchangeErrorState);
  const { loadCurrentUser } = useLoadCurrentUser();
  const hasAttemptedRef = useRef(false);
  const exchangeOrgIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    if (exchangeOrgIdRef.current !== orgId) {
      hasAttemptedRef.current = false;
      exchangeOrgIdRef.current = orgId;
    }

    const exchange = async () => {
      if (!isLoaded || !isSignedIn || tokenPair || hasAttemptedRef.current) {
        return;
      }

      if (!orgId) {
        return;
      }

      hasAttemptedRef.current = true;
      setExchangeError(null);

      try {
        const clerkToken = await getToken();

        if (!clerkToken) {
          hasAttemptedRef.current = false;
          setExchangeError(
            'Could not read a Clerk session token. Try signing out and signing in again.',
          );
          return;
        }

        const controller = new AbortController();
        const timeoutId = window.setTimeout(
          () => controller.abort(),
          EXCHANGE_TIMEOUT_MS,
        );

        let response: Response;

        try {
          response = await fetch('/auth/clerk/exchange', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${clerkToken}`,
              ...(orgId ? { 'X-Clerk-Org-Id': orgId } : {}),
            },
            signal: controller.signal,
          });
        } finally {
          window.clearTimeout(timeoutId);
        }

        if (!response.ok) {
          const body = await response.text().catch(() => '');
          const hint =
            response.status === 401 || response.status === 403
              ? ' (check org membership and server CLERK_SECRET_KEY)'
              : '';
          throw new Error(
            `Clerk exchange failed (${response.status})${hint}${body ? ` — ${body.slice(0, 200)}` : ''}`,
          );
        }

        const { tokens } = (await response.json()) as { tokens: AuthTokenPair };

        setTokenPair(tokens);
        await loadCurrentUser();
        setExchangeError(null);
      } catch (error) {
        // oxlint-disable-next-line no-console
        console.error('[KONNECCT-CLERK] Session exchange failed', error);
        hasAttemptedRef.current = false;
        const message =
          error instanceof Error && error.name === 'AbortError'
            ? 'Sign-in timed out reaching the server. Check network, nginx, and crm-server logs.'
            : error instanceof Error
              ? error.message
              : 'Clerk sign-in could not be completed.';
        setExchangeError(message);
      }
    };

    void exchange();
  }, [
    getToken,
    isLoaded,
    isSignedIn,
    loadCurrentUser,
    orgId,
    setTokenPair,
    setExchangeError,
    tokenPair,
  ]);

  return null;
};
