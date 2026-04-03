import { tokenPairState } from '@/auth/states/tokenPairState';
import { useAtomState } from '@/ui/utilities/state/jotai/hooks/useAtomState';

/** True only when `tokenPair` exists; Clerk session alone does not authorize GraphQL. */
export const useHasAccessTokenPair = (): boolean => {
  const [tokenPair] = useAtomState(tokenPairState);

  return tokenPair !== null;
};
