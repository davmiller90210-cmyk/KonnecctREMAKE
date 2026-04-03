import {
  SignIn,
  SignUp,
  SignedIn,
  SignedOut,
  useAuth,
  UserButton,
} from '@clerk/clerk-react';
import { useMemo } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { AppPath } from 'twenty-shared/types';

import { tokenPairState } from '@/auth/states/tokenPairState';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import { CLERK_PUBLISHABLE_KEY } from '~/config';

export const ClerkSignInUp = () => {
  const location = useLocation();
  const tokenPair = useAtomStateValue(tokenPairState);
  const { isLoaded: isClerkLoaded, orgId } = useAuth();

  const shouldUseSignUp = useMemo(() => {
    const params = new URLSearchParams(location.search);
    const mode = params.get('mode');

    return location.pathname.includes('invite') || mode === 'sign-up';
  }, [location.pathname, location.search]);

  if (!CLERK_PUBLISHABLE_KEY) {
    return (
      <div style={{ padding: 24 }}>
        Clerk is not configured. Set NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY (or
        REACT_APP_CLERK_PUBLISHABLE_KEY) and restart the server.
      </div>
    );
  }

  return (
    <>
      <SignedIn>
        {!isClerkLoaded ? (
          <div style={{ padding: 24 }}>Loading…</div>
        ) : tokenPair ? (
          <Navigate to="/chat" replace />
        ) : (
          <div
            style={{
              padding: 24,
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
              alignItems: 'center',
            }}
          >
            {!orgId ? (
              <>
                <p style={{ margin: 0 }}>
                  Select a Clerk organization to open Konnecct (tenant required).
                </p>
                <p style={{ margin: 0, fontSize: 14, color: '#666' }}>
                  Use your profile menu to create or join an org.
                </p>
                <UserButton />
              </>
            ) : (
              <p style={{ margin: 0 }}>Completing sign-in…</p>
            )}
          </div>
        )}
      </SignedIn>
      <SignedOut>
        {shouldUseSignUp ? (
          <SignUp
            forceRedirectUrl="/chat"
            signInUrl={AppPath.SignInUp}
            fallbackRedirectUrl="/chat"
          />
        ) : (
          <SignIn
            forceRedirectUrl="/chat"
            signUpUrl={`${AppPath.SignInUp}?mode=sign-up`}
            fallbackRedirectUrl="/chat"
          />
        )}
      </SignedOut>
    </>
  );
};
