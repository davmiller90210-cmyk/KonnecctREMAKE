import { ChatEmbedLayout } from '@/ui/layout/page/components/ChatEmbedLayout';
import { DefaultLayout } from '@/ui/layout/page/components/DefaultLayout';
import { useLocation } from 'react-router-dom';

import { REACT_APP_CHAT_PROVIDER } from '~/config';

const isMattermostChatPath = (pathname: string) =>
  pathname === '/chat' ||
  pathname.startsWith('/chat/c/') ||
  pathname.startsWith('/chat/dm/');

/**
 * Uses a full-width layout (no CRM drawer) for Mattermost chat routes when chat provider is mattermost.
 */
export const MainLayoutSwitcher = () => {
  const { pathname } = useLocation();

  const useChatEmbed =
    REACT_APP_CHAT_PROVIDER === 'mattermost' && isMattermostChatPath(pathname);

  return useChatEmbed ? <ChatEmbedLayout /> : <DefaultLayout />;
};
