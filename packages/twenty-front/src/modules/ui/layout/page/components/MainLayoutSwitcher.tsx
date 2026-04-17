import { ChatEmbedLayout } from '@/ui/layout/page/components/ChatEmbedLayout';
import { DefaultLayout } from '@/ui/layout/page/components/DefaultLayout';
import { useLocation } from 'react-router-dom';

const isNativeChatPath = (pathname: string) =>
  pathname === '/chat' ||
  pathname.startsWith('/chat/c/') ||
  pathname.startsWith('/chat/dm/');

/**
 * Full-width layout (ChatEmbedLayout with Sendbird) for /chat routes;
 * DefaultLayout (with CRM nav drawer) for everything else.
 */
export const MainLayoutSwitcher = () => {
  const { pathname } = useLocation();
  return isNativeChatPath(pathname) ? <ChatEmbedLayout /> : <DefaultLayout />;
};
