import { useIsChatPage } from '@/navigation/hooks/useIsChatPage';
import { currentMobileNavigationDrawerState } from '@/navigation/states/currentMobileNavigationDrawerState';
import { useIsMobile } from '@/ui/utilities/responsive/hooks/useIsMobile';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';

export const useIsChatDrawer = () => {
  const isMobile = useIsMobile();
  const isChatPage = useIsChatPage();
  const currentMobileNavigationDrawer = useAtomStateValue(
    currentMobileNavigationDrawerState,
  );

  return isMobile
    ? currentMobileNavigationDrawer === 'chat'
    : isChatPage;
};
