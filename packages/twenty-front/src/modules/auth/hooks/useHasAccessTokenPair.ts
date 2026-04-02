import { tokenPairState } from '@/auth/states/tokenPairState';
import { useAtomState } from '@/ui/utilities/state/jotai/hooks/useAtomState';

export const useHasAccessTokenPair = (): boolean => {
  const [tokenPair] = useAtomState(tokenPairState);

  if (tokenPair) {
    return true;
  }

  if (typeof window !== 'undefined') {
    const clerk = (
      window as Window & {
        Clerk?: { session?: { id?: string | null }; user?: { id?: string | null } };
      }
    ).Clerk;

    return Boolean(clerk?.session?.id || clerk?.user?.id);
  }

  return false;
};
