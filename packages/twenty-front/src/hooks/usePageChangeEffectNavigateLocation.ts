import { verifyEmailRedirectPathState } from '@/app/states/verifyEmailRedirectPathState';
import { ONBOARDING_PATHS } from '@/auth/constants/OnboardingPaths';
import { ONGOING_USER_CREATION_PATHS } from '@/auth/constants/OngoingUserCreationPaths';
import { useHasAccessTokenPair } from '@/auth/hooks/useHasAccessTokenPair';
import { returnToPathState } from '@/auth/states/returnToPathState';
import {
  currentWorkspaceState,
  type CurrentWorkspace,
} from '@/auth/states/currentWorkspaceState';
import { calendarBookingPageIdState } from '@/client-config/states/calendarBookingPageIdState';
import { isMultiWorkspaceEnabledState } from '@/client-config/states/isMultiWorkspaceEnabledState';
import { useIsCurrentLocationOnAWorkspace } from '@/domain-manager/hooks/useIsCurrentLocationOnAWorkspace';
import { useDefaultHomePagePath } from '@/navigation/hooks/useDefaultHomePagePath';
import { objectMetadataItemsSelector } from '@/object-metadata/states/objectMetadataItemsSelector';
import { useOnboardingStatus } from '@/onboarding/hooks/useOnboardingStatus';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import { useIsWorkspaceActivationStatusEqualsTo } from '@/workspace/hooks/useIsWorkspaceActivationStatusEqualsTo';
import { isValidReturnToPath } from '@/auth/utils/isValidReturnToPath';
import { isNonEmptyString } from '@sniptt/guards';
import { useLocation, useParams } from 'react-router-dom';
import { AppPath, SettingsPath } from 'twenty-shared/types';
import { isDefined } from 'twenty-shared/utils';
import { WorkspaceActivationStatus } from 'twenty-shared/workspace';
import { OnboardingStatus } from '~/generated-metadata/graphql';
import { getWorkspaceUrl } from '~/utils/getWorkspaceUrl';
import { isMatchingLocation } from '~/utils/isMatchingLocation';

const isBrowserHostnameMatchingWorkspaceUrl = (
  workspace: CurrentWorkspace | null,
): boolean => {
  if (!isDefined(workspace?.workspaceUrls)) {
    return false;
  }

  try {
    const workspaceHostname = new URL(
      getWorkspaceUrl(workspace.workspaceUrls),
    ).hostname;

    return workspaceHostname === window.location.hostname;
  } catch {
    return false;
  }
};

const readReturnToPathFromUrlSearchParams = (): string | null => {
  const value = new URLSearchParams(window.location.search).get('returnToPath');

  return value && isValidReturnToPath(value) ? value : null;
};

export const usePageChangeEffectNavigateLocation = () => {
  const hasAccessTokenPair = useHasAccessTokenPair();
  const { isOnAWorkspace } = useIsCurrentLocationOnAWorkspace();
  const isMultiWorkspaceEnabled = useAtomStateValue(isMultiWorkspaceEnabledState);
  const currentWorkspace = useAtomStateValue(currentWorkspaceState);
  const onboardingStatus = useOnboardingStatus();
  const isWorkspaceSuspended = useIsWorkspaceActivationStatusEqualsTo(
    WorkspaceActivationStatus.SUSPENDED,
  );
  const { defaultHomePagePath } = useDefaultHomePagePath();
  const location = useLocation();
  const calendarBookingPageId = useAtomStateValue(calendarBookingPageIdState);

  // Default-domain hosts still serve workspaces whose custom/subdomain URL uses
  // the same hostname (Clerk single-URL + org mapping). Without this, having a
  // token but isOnAWorkspace=false bounces /welcome ↔ CRM forever.
  const isSessionAllowedOnThisHostname =
    !isMultiWorkspaceEnabled ||
    isOnAWorkspace ||
    !isDefined(currentWorkspace) ||
    isBrowserHostnameMatchingWorkspaceUrl(currentWorkspace);

  const canNavigateIntoAppFromAuthFlow =
    !isMultiWorkspaceEnabled ||
    isOnAWorkspace ||
    (isDefined(currentWorkspace) &&
      isBrowserHostnameMatchingWorkspaceUrl(currentWorkspace));

  const someMatchingLocationOf = (appPaths: AppPath[]): boolean =>
    appPaths.some((appPath) => isMatchingLocation(location, appPath));

  const objectNamePlural = useParams().objectNamePlural ?? '';
  const objectMetadataItems = useAtomStateValue(objectMetadataItemsSelector);
  const objectMetadataItem = objectMetadataItems?.find(
    (objectMetadataItem) => objectMetadataItem.namePlural === objectNamePlural,
  );
  const verifyEmailRedirectPath = useAtomStateValue(
    verifyEmailRedirectPathState,
  );

  const returnToPath = useAtomStateValue(returnToPathState);
  const resolvedReturnToPath = isNonEmptyString(returnToPath)
    ? returnToPath
    : readReturnToPathFromUrlSearchParams();

  if (
    (!hasAccessTokenPair ||
      (hasAccessTokenPair && !isSessionAllowedOnThisHostname)) &&
    !someMatchingLocationOf([
      ...ONGOING_USER_CREATION_PATHS,
      AppPath.ResetPassword,
    ])
  ) {
    return AppPath.SignInUp;
  }

  if (
    onboardingStatus === OnboardingStatus.PLAN_REQUIRED &&
    !someMatchingLocationOf([
      AppPath.PlanRequired,
      AppPath.PlanRequiredSuccess,
      AppPath.BookCall,
      AppPath.BookCallDecision,
    ])
  ) {
    if (
      isMatchingLocation(location, AppPath.VerifyEmail) &&
      isDefined(verifyEmailRedirectPath)
    ) {
      return verifyEmailRedirectPath;
    }
    return AppPath.PlanRequired;
  }

  if (isWorkspaceSuspended) {
    if (!isMatchingLocation(location, AppPath.SettingsCatchAll)) {
      return `${AppPath.SettingsCatchAll.replace('/*', '')}/${
        SettingsPath.Billing
      }`;
    }

    return;
  }

  if (
    onboardingStatus === OnboardingStatus.WORKSPACE_ACTIVATION &&
    !someMatchingLocationOf([
      AppPath.CreateWorkspace,
      AppPath.BookCallDecision,
      AppPath.BookCall,
    ])
  ) {
    return AppPath.CreateWorkspace;
  }

  if (
    onboardingStatus === OnboardingStatus.PROFILE_CREATION &&
    !isMatchingLocation(location, AppPath.CreateProfile)
  ) {
    return AppPath.CreateProfile;
  }

  if (
    onboardingStatus === OnboardingStatus.SYNC_EMAIL &&
    !isMatchingLocation(location, AppPath.SyncEmails)
  ) {
    return AppPath.SyncEmails;
  }

  if (
    onboardingStatus === OnboardingStatus.INVITE_TEAM &&
    !isMatchingLocation(location, AppPath.InviteTeam)
  ) {
    return AppPath.InviteTeam;
  }

  if (
    onboardingStatus === OnboardingStatus.BOOK_ONBOARDING &&
    !someMatchingLocationOf([AppPath.BookCallDecision, AppPath.BookCall])
  ) {
    if (!isDefined(calendarBookingPageId)) {
      return defaultHomePagePath;
    }
    return AppPath.BookCallDecision;
  }

  if (
    onboardingStatus === OnboardingStatus.COMPLETED &&
    someMatchingLocationOf([
      ...ONBOARDING_PATHS,
      ...ONGOING_USER_CREATION_PATHS,
    ]) &&
    !isMatchingLocation(location, AppPath.ResetPassword) &&
    hasAccessTokenPair &&
    canNavigateIntoAppFromAuthFlow
  ) {
    return resolvedReturnToPath ?? defaultHomePagePath;
  }

  if (isMatchingLocation(location, AppPath.Index) && hasAccessTokenPair) {
    return resolvedReturnToPath ?? defaultHomePagePath;
  }

  if (
    isMatchingLocation(location, AppPath.RecordIndexPage) &&
    !isDefined(objectMetadataItem)
  ) {
    return AppPath.NotFound;
  }

  return;
};
