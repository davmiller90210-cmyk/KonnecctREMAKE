import { useLocation } from 'react-router-dom';

export const useIsChatPage = () => {
  const { pathname } = useLocation();

  return (
    pathname === '/chat' ||
    pathname.startsWith('/chat/') ||
    pathname.startsWith('/chat?')
  );
};
