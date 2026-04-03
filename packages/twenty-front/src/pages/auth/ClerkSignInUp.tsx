import {
  SignIn,
  SignUp,
  SignedIn,
  SignedOut,
  useAuth,
  useClerk,
  UserButton,
} from '@clerk/clerk-react';
import { useMemo } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { AppPath } from 'twenty-shared/types';

import { clerkExchangeErrorState } from '@/auth/states/clerkExchangeErrorState';
import { tokenPairState } from '@/auth/states/tokenPairState';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import { useSetAtomState } from '@/ui/utilities/state/jotai/hooks/useSetAtomState';
import { CLERK_PUBLISHABLE_KEY } from '~/config';

export const ClerkSignInUp = () => {
  const location = useLocation();
  const tokenPair = useAtomStateValue(tokenPairState);
  const exchangeError = useAtomStateValue(clerkExchangeErrorState);
  const setExchangeError = useSetAtomState(clerkExchangeErrorState);
  const setTokenPair = useSetAtomState(tokenPairState);
  const { signOut } = useClerk();
  const { isLoaded: isClerkLoaded, orgId } = useAuth();

  const handleSignOutClerk = async () => {
    setExchangeError(null);
    setTokenPair(null);
    await signOut({ redirectUrl: `${window.location.origin}${AppPath.SignInUp}` });
  };

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
              maxWidth: 480,
              marginInline: 'auto',
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
            {exchangeError ? (
              <p
                style={{
                  margin: 0,
                  fontSize: 14,
                  color: '#f87171',
                  whiteSpace: 'pre-wrap',
                }}
              >
                {exchangeError}
              </p>
            ) : null}
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
              <button
                type="button"
                onClick={() => {
                  setExchangeError(null);
                  window.location.reload();
                }}
                style={{
                  padding: '8px 16px',
                  cursor: 'pointer',
                  borderRadius: 8,
                  border: '1px solid #444',
                  background: '#1a1a1a',
                  color: '#eee',
                }}
              >
                Retry
              </button>
              <button
                type="button"
                onClick={() => {
                  void handleSignOutClerk();
                }}
                style={{
                  padding: '8px 16px',
                  cursor: 'pointer',
                  borderRadius: 8,
                  border: '1px solid #444',
                  background: '#2a2a2a',
                  color: '#eee',
                }}
              >
                Sign out
              </button>
            </div>
            <p style={{ margin: 0, fontSize: 12, color: '#888' }}>
              Sign out if you need a different account or the app stays on this screen.
            </p>
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
