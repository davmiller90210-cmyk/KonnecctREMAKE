import { useLocation } from 'react-router-dom';
import { useLingui } from '@lingui/react/macro';
import { IconMessage } from 'twenty-ui/display';

import { NavigationDrawerItem } from '@/ui/navigation/navigation-drawer/components/NavigationDrawerItem';

/**
 * Minimal communications entry in the CRM nav drawer.
 * Sendbird manages its own channel/DM sidebar inside the hub — we just
 * provide a top-level nav link here.
 */
export const MainNavigationDrawerRecentChats = () => {
  const { t } = useLingui();
  const location = useLocation();

  return (
    <NavigationDrawerItem
      label={t`Messages`}
      to="/chat"
      Icon={IconMessage}
      active={
        location.pathname === '/chat' ||
        location.pathname.startsWith('/chat/c/') ||
        location.pathname.startsWith('/chat/dm/')
      }
    />
  );
};
