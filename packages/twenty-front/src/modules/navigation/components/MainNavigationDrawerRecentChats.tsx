import { useAtomValue } from 'jotai';
import { useLocation } from 'react-router-dom';
import { styled } from '@linaria/react';
import { useLingui } from '@lingui/react/macro';
import { IconMessage, IconCircle } from 'twenty-ui/display';
import { themeCssVariables } from 'twenty-ui/theme-constants';

import { 
  agoraConversationsAtom, 
  agoraConnectionStateAtom 
} from '@/chat/states/agoraSessionState';
import { NavigationDrawerItem } from '@/ui/navigation/navigation-drawer/components/NavigationDrawerItem';

const StyledSectionHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${themeCssVariables.spacing[4]} ${themeCssVariables.spacing[2]} ${themeCssVariables.spacing[1]};
  font-size: ${themeCssVariables.font.size.xs};
  font-weight: ${themeCssVariables.font.weight.semiBold};
  color: ${themeCssVariables.font.color.tertiary};
  text-transform: uppercase;
  letter-spacing: 0.04em;
`;

const StyledStatusDot = styled.div<{ isConnected: boolean }>`
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: ${({ isConnected }) => isConnected ? themeCssVariables.color.green : themeCssVariables.color.orange};
  margin-left: ${themeCssVariables.spacing[2]};
`;

const StyledCounter = styled.span`
  background: ${themeCssVariables.color.blue9};
  color: white;
  border-radius: 10px;
  padding: 0 6px;
  font-size: 10px;
  font-weight: bold;
  margin-left: auto;
`;

export const MainNavigationDrawerRecentChats = () => {
  const { t } = useLingui();
  const location = useLocation();
  const conversations = useAtomValue(agoraConversationsAtom);
  const connectionState = useAtomValue(agoraConnectionStateAtom);

  const isConnected = connectionState === 'connected';

  // Only show the top 5 recent conversations in the sidebar
  const recentConversations = conversations.slice(0, 8);

  return (
    <>
      <StyledSectionHeader>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          {t`Direct Messages`}
          <StyledStatusDot isConnected={isConnected} title={connectionState} />
        </div>
      </StyledSectionHeader>

      {recentConversations.map((conv) => {
        const isSelected = location.pathname === `/chat/${conv.id}`;
        const displayName = conv.name || conv.id;

        return (
          <NavigationDrawerItem
            key={conv.id}
            label={displayName}
            to={`/chat/${conv.id}`}
            active={isSelected}
            Icon={IconCircle} // Using a circle icon as a fallback for user avatar
            rightOptions={conv.unreadCount > 0 ? <StyledCounter>{conv.unreadCount}</StyledCounter> : null}
            alwaysShowRightOptions={true}
          />
        );
      })}

      {conversations.length === 0 && (
        <NavigationDrawerItem
          label={t`No active chats`}
          Icon={IconMessage}
          variant="tertiary"
          active={false}
        />
      )}

      <NavigationDrawerItem
        label={t`All Messages`}
        to="/chat"
        Icon={IconMessage}
        active={location.pathname === '/chat'}
        variant="tertiary"
      />
    </>
  );
};
