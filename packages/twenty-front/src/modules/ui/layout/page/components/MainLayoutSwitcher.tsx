import { ChatEmbedLayout } from '@/ui/layout/page/components/ChatEmbedLayout';
import { DefaultLayout } from '@/ui/layout/page/components/DefaultLayout';
import { useLocation } from 'react-router-dom';

import { REACT_APP_CHAT_PROVIDER } from '~/config';

const isNativeChatPath = (pathname: string) =>
  pathname === '/chat' ||
  pathname.startsWith('/chat/c/') ||
  pathname.startsWith('/chat/dm/');

/**
 * Full-width layout (no CRM drawer) for embedded Mattermost or native Sendbird chat routes.
 */
export const MainLayoutSwitcher = () => {
  const { pathname } = useLocation();

  const useFullBleedChat =
    isNativeChatPath(pathname) &&
    (REACT_APP_CHAT_PROVIDER === 'mattermost' ||
      REACT_APP_CHAT_PROVIDER === 'sendbird');

  return useFullBleedChat ? <ChatEmbedLayout /> : <DefaultLayout />;
};
