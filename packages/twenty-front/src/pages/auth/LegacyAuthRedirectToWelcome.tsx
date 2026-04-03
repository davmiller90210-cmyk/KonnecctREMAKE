import { Navigate, useLocation } from 'react-router-dom';
import { AppPath } from 'twenty-shared/types';

type LegacyAuthRedirectToWelcomeProps = {
  /** Adds mode=sign-up for legacy /invite/:hash links so Clerk opens sign-up when appropriate */
  preferSignUpMode?: boolean;
};

export const LegacyAuthRedirectToWelcome = ({
  preferSignUpMode = false,
}: LegacyAuthRedirectToWelcomeProps) => {
  const location = useLocation();
  const params = new URLSearchParams(location.search);

  if (preferSignUpMode && !params.has('mode')) {
    params.set('mode', 'sign-up');
  }

  const search = params.toString();
  const to = search.length > 0 ? `${AppPath.SignInUp}?${search}` : AppPath.SignInUp;

  return <Navigate to={to} replace />;
};
