import { createAtomState } from '@/ui/utilities/state/jotai/utils/createAtomState';

export const currentMobileNavigationDrawerState = createAtomState<
  'main' | 'settings' | 'chat'
>({
  key: 'currentMobileNavigationDrawerState',
  defaultValue: 'main',
});
