import { SignIn, SignUp, SignedIn, SignedOut } from '@clerk/clerk-react';
import { useMemo } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { AppPath } from 'twenty-shared/types';

export const ClerkSignInUp = () => {
  const location = useLocation();

  const shouldUseSignUp = useMemo(() => {
    const params = new URLSearchParams(location.search);
    const mode = params.get('mode');

    return location.pathname.includes('invite') || mode === 'sign-up';
  }, [location.pathname, location.search]);

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
