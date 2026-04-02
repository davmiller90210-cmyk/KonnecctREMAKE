import { SignIn, SignUp, SignedIn, SignedOut } from '@clerk/clerk-react';
import { useMemo } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { AppPath } from 'twenty-shared/types';
import { CLERK_PUBLISHABLE_KEY } from '~/config';

export const ClerkSignInUp = () => {
  const location = useLocation();

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
        <Navigate to="/chat" replace />
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
