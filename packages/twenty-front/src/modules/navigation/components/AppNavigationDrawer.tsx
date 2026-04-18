import { ChatNavigationDrawer } from '@/chat/components/ChatNavigationDrawer';
import { useIsChatDrawer } from '@/navigation/hooks/useIsChatDrawer';
import { useIsSettingsDrawer } from '@/navigation/hooks/useIsSettingsDrawer';

import { MainNavigationDrawer } from '@/navigation/components/MainNavigationDrawer';
import { SettingsNavigationDrawer } from '@/navigation/components/SettingsNavigationDrawer';

export type AppNavigationDrawerProps = {
  className?: string;
};

export const AppNavigationDrawer = ({
  className,
}: AppNavigationDrawerProps) => {
  const isSettingsDrawer = useIsSettingsDrawer();
  const isChatDrawer = useIsChatDrawer();

  if (isSettingsDrawer) {
    return <SettingsNavigationDrawer className={className} />;
  }

  if (isChatDrawer) {
    return <ChatNavigationDrawer className={className} />;
  }

  return <MainNavigationDrawer className={className} />;
};
