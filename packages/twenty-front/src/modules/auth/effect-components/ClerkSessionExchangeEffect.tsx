import { useAuth as useClerkAuth } from '@clerk/clerk-react';
import { useEffect, useRef } from 'react';

import { tokenPairState } from '@/auth/states/tokenPairState';
import { useLoadCurrentUser } from '@/users/hooks/useLoadCurrentUser';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import { useSetAtomState } from '@/ui/utilities/state/jotai/hooks/useSetAtomState';
import { type AuthTokenPair } from '~/generated-metadata/graphql';

export const ClerkSessionExchangeEffect = () => {
  const { isLoaded, isSignedIn, getToken, orgId } = useClerkAuth();
  const tokenPair = useAtomStateValue(tokenPairState);
  const setTokenPair = useSetAtomState(tokenPairState);
  const { loadCurrentUser } = useLoadCurrentUser();
  const hasAttemptedRef = useRef(false);

  useEffect(() => {
    const exchange = async () => {
      if (!isLoaded || !isSignedIn || tokenPair || hasAttemptedRef.current) {
        return;
      }

      if (!orgId) {
        return;
      }

      hasAttemptedRef.current = true;

      try {
        const clerkToken = await getToken();

        if (!clerkToken) {
          hasAttemptedRef.current = false;
          return;
        }

        const response = await fetch('/auth/clerk/exchange', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${clerkToken}`,
            ...(orgId ? { 'X-Clerk-Org-Id': orgId } : {}),
          },
        });

        if (!response.ok) {
          throw new Error(`Clerk exchange failed (${response.status})`);
        }

        const { tokens } = (await response.json()) as { tokens: AuthTokenPair };

        setTokenPair(tokens);
        await loadCurrentUser();
      } catch (error) {
        // oxlint-disable-next-line no-console
        console.error('[KONNECCT-CLERK] Session exchange failed', error);
        hasAttemptedRef.current = false;
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
    tokenPair,
  ]);

  return null;
};
