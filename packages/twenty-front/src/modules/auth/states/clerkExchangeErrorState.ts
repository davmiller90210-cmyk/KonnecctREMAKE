import { createAtomState } from '@/ui/utilities/state/jotai/utils/createAtomState';

export const clerkExchangeErrorState = createAtomState<string | null>({
  key: 'clerkExchangeErrorState',
  defaultValue: null,
});
