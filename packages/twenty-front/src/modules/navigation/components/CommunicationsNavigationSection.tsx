import { useAtomValue } from 'jotai';
import { useLocation, useNavigate } from 'react-router-dom';

import { chatTotalUnreadState } from '@/chat/states/chatUnreadState';
import { isChatConversationRailOpenState } from '@/chat/states/isChatConversationRailOpenState';
import { CommunicationsSectionHeader } from '@/navigation/components/CommunicationsSectionHeader';
import { NavigationDrawerSection } from '@/ui/navigation/navigation-drawer/components/NavigationDrawerSection';
import { isNavigationDrawerExpandedState } from '@/ui/navigation/states/isNavigationDrawerExpanded';
import { useIsMobile } from '@/ui/utilities/responsive/hooks/useIsMobile';
import { useAtomState } from '@/ui/utilities/state/jotai/hooks/useAtomState';
import { useSetAtomState } from '@/ui/utilities/state/jotai/hooks/useSetAtomState';
import { NotificationCounter } from 'twenty-ui/navigation';

export const CommunicationsNavigationSection = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const chatTotalUnread = useAtomValue(chatTotalUnreadState);
  const showChatUnread =
    chatTotalUnread > 0 && !location.pathname.startsWith('/chat');

  const [isRailOpen, setRailOpen] = useAtomState(
    isChatConversationRailOpenState,
  );
  const setNavExpanded = useSetAtomState(isNavigationDrawerExpandedState);

  const handleToggle = () => {
    if (isMobile) {
      navigate('/chat');
      return;
    }
    if (isRailOpen) {
      setRailOpen(false);
      setNavExpanded(true);
    } else {
      setRailOpen(true);
      setNavExpanded(false);
    }
  };

  return (
    <NavigationDrawerSection>
      <CommunicationsSectionHeader
        isOpen={isRailOpen}
        onToggle={handleToggle}
        rightIcon={
          showChatUnread ? (
            <NotificationCounter count={chatTotalUnread} />
          ) : undefined
        }
      />
    </NavigationDrawerSection>
  );
};
