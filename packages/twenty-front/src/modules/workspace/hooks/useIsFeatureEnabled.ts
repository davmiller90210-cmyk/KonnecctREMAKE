import { currentWorkspaceState } from '@/auth/states/currentWorkspaceState';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import { FeatureFlagKey } from '~/generated-metadata/graphql';

export const useIsFeatureEnabled = (featureKey: FeatureFlagKey | null) => {
  const currentWorkspace = useAtomStateValue(currentWorkspaceState);

  if (!featureKey) {
    return false;
  }

  if (featureKey === FeatureFlagKey.IS_AI_ENABLED) {
    return true;
  }

  const featureFlag = currentWorkspace?.featureFlags?.find(
    (flag) => flag.key === featureKey,
  );

  return !!featureFlag?.value;
};
