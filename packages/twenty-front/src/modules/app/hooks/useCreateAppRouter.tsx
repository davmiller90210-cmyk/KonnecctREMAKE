import { AppRouterProviders } from '@/app/components/AppRouterProviders';
import { LazyRoute } from '@/app/components/LazyRoute';
import { SettingsRoutes } from '@/app/components/SettingsRoutes';
import indexAppPath from '@/navigation/utils/indexAppPath';
import { BlankLayout } from '@/ui/layout/page/components/BlankLayout';
import { DefaultLayout } from '@/ui/layout/page/components/DefaultLayout';
import { AppPath } from 'twenty-shared/types';

import { lazy } from 'react';
import {
  createBrowserRouter,
  createRoutesFromElements,
  Route,
} from 'react-router-dom';

const RecordIndexPage = lazy(() =>
  import('~/pages/object-record/RecordIndexPage').then((module) => ({
    default: module.RecordIndexPage,
  })),
);

const RecordShowPage = lazy(() =>
  import('~/pages/object-record/RecordShowPage').then((module) => ({
    default: module.RecordShowPage,
  })),
);

const ClerkSignInUp = lazy(() =>
  import('~/pages/auth/ClerkSignInUp').then((module) => ({
    default: module.ClerkSignInUp,
  })),
);

const LegacyAuthRedirectToWelcome = lazy(() =>
  import('~/pages/auth/LegacyAuthRedirectToWelcome').then((module) => ({
    default: module.LegacyAuthRedirectToWelcome,
  })),
);

const Authorize = lazy(() =>
  import('~/pages/auth/Authorize').then((module) => ({
    default: module.Authorize,
  })),
);

const CommunicationHub = lazy(() =>
  import('@/chat/components/CommunicationHub').then((module) => ({
    default: module.CommunicationHub,
  })),
);

const CreateWorkspace = lazy(() =>
  import('~/pages/onboarding/CreateWorkspace').then((module) => ({
    default: module.CreateWorkspace,
  })),
);

const CreateProfile = lazy(() =>
  import('~/pages/onboarding/CreateProfile').then((module) => ({
    default: module.CreateProfile,
  })),
);

const SyncEmails = lazy(() =>
  import('~/pages/onboarding/SyncEmails').then((module) => ({
    default: module.SyncEmails,
  })),
);

const InviteTeam = lazy(() =>
  import('~/pages/onboarding/InviteTeam').then((module) => ({
    default: module.InviteTeam,
  })),
);

const ChooseYourPlan = lazy(() =>
  import('~/pages/onboarding/ChooseYourPlan').then((module) => ({
    default: module.ChooseYourPlan,
  })),
);

const PaymentSuccess = lazy(() =>
  import('~/pages/onboarding/PaymentSuccess').then((module) => ({
    default: module.PaymentSuccess,
  })),
);

const BookCallDecision = lazy(() =>
  import('~/pages/onboarding/BookCallDecision').then((module) => ({
    default: module.BookCallDecision,
  })),
);

const BookCall = lazy(() =>
  import('~/pages/onboarding/BookCall').then((module) => ({
    default: module.BookCall,
  })),
);

const NotFound = lazy(() =>
  import('~/pages/not-found/NotFound').then((module) => ({
    default: module.NotFound,
  })),
);

export const useCreateAppRouter = (
  isFunctionSettingsEnabled?: boolean,
  isAdminPageEnabled?: boolean,
) =>
  createBrowserRouter(
    createRoutesFromElements(
      <Route
        element={<AppRouterProviders />}
        // To switch state to `loading` temporarily to enable us
        // to set scroll position before the page is rendered
        loader={async () => Promise.resolve(null)}
      >
        <Route element={<DefaultLayout />}>
          <Route
            path="/chat"
            element={
              <LazyRoute>
                <CommunicationHub />
              </LazyRoute>
            }
          />
          <Route
            path="/chat/c/:channelId"
            element={
              <LazyRoute>
                <CommunicationHub />
              </LazyRoute>
            }
          />
          <Route
            path="/chat/dm/:dmThreadId"
            element={
              <LazyRoute>
                <CommunicationHub />
              </LazyRoute>
            }
          />
          <Route
            path={AppPath.Verify}
            element={
              <LazyRoute>
                <LegacyAuthRedirectToWelcome />
              </LazyRoute>
            }
          />
          <Route
            path={AppPath.VerifyEmail}
            element={
              <LazyRoute>
                <LegacyAuthRedirectToWelcome />
              </LazyRoute>
            }
          />
          <Route
            path={AppPath.SignInUp}
            element={
              <LazyRoute>
                <ClerkSignInUp />
              </LazyRoute>
            }
          />
          <Route
            path={AppPath.Invite}
            element={
              <LazyRoute>
                <LegacyAuthRedirectToWelcome preferSignUpMode />
              </LazyRoute>
            }
          />
          <Route
            path={AppPath.ResetPassword}
            element={
              <LazyRoute>
                <LegacyAuthRedirectToWelcome />
              </LazyRoute>
            }
          />
          <Route
            path={AppPath.CreateWorkspace}
            element={
              <LazyRoute>
                <CreateWorkspace />
              </LazyRoute>
            }
          />
          <Route
            path={AppPath.CreateProfile}
            element={
              <LazyRoute>
                <CreateProfile />
              </LazyRoute>
            }
          />
          <Route
            path={AppPath.SyncEmails}
            element={
              <LazyRoute>
                <SyncEmails />
              </LazyRoute>
            }
          />
          <Route
            path={AppPath.InviteTeam}
            element={
              <LazyRoute>
                <InviteTeam />
              </LazyRoute>
            }
          />
          <Route
            path={AppPath.PlanRequired}
            element={
              <LazyRoute>
                <ChooseYourPlan />
              </LazyRoute>
            }
          />
          <Route
            path={AppPath.PlanRequiredSuccess}
            element={
              <LazyRoute>
                <PaymentSuccess />
              </LazyRoute>
            }
          />
          <Route
            path={AppPath.BookCallDecision}
            element={
              <LazyRoute>
                <BookCallDecision />
              </LazyRoute>
            }
          />
          <Route
            path={AppPath.BookCall}
            element={
              <LazyRoute>
                <BookCall />
              </LazyRoute>
            }
          />
          <Route path={indexAppPath.getIndexAppPath()} element={<></>} />
          <Route
            path={AppPath.RecordIndexPage}
            element={
              <LazyRoute>
                <RecordIndexPage />
              </LazyRoute>
            }
          />
          <Route
            path={AppPath.RecordShowPage}
            element={
              <LazyRoute>
                <RecordShowPage />
              </LazyRoute>
            }
          />
          <Route
            path={AppPath.SettingsCatchAll}
            element={
              <SettingsRoutes
                isFunctionSettingsEnabled={isFunctionSettingsEnabled}
                isAdminPageEnabled={isAdminPageEnabled}
              />
            }
          />
          <Route
            path={AppPath.NotFoundWildcard}
            element={
              <LazyRoute>
                <NotFound />
              </LazyRoute>
            }
          />
        </Route>
        <Route element={<BlankLayout />}>
          <Route
            path={AppPath.Authorize}
            element={
              <LazyRoute>
                <Authorize />
              </LazyRoute>
            }
          />
        </Route>
      </Route>,
    ),
  );
