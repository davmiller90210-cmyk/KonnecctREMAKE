import { styled } from '@linaria/react';
import { themeCssVariables } from 'twenty-ui/theme-constants';
import { Room } from 'matrix-js-sdk';

// ─── Layout ───────────────────────────────────────────────────────────────────

const StyledSidebar = styled.aside`
  display: flex;
  flex-direction: column;
  width: 240px;
  flex-shrink: 0;
  border-right: 1px solid ${themeCssVariables.border.color.medium};
  background: ${themeCssVariables.background.secondary};
  overflow-y: auto;
  height: 100%;
`;

const StyledSidebarHeader = styled.div`
  padding: ${themeCssVariables.spacing[4]} ${themeCssVariables.spacing[3]};
  border-bottom: 1px solid ${themeCssVariables.border.color.light};
  font-size: ${themeCssVariables.font.size.sm};
  font-weight: ${themeCssVariables.font.weight.medium};
  color: ${themeCssVariables.font.color.secondary};
  font-family: ${themeCssVariables.font.family};
  text-transform: uppercase;
  letter-spacing: 0.04em;
`;

const StyledRoomList = styled.ul`
  list-style: none;
  padding: ${themeCssVariables.spacing[1]} 0;
  margin: 0;
  flex: 1 1 auto;
`;

interface StyledRoomItemProps {
  isSelected: boolean;
}

const StyledRoomItem = styled.li<StyledRoomItemProps>`
  display: flex;
  align-items: center;
  gap: ${themeCssVariables.spacing[2]};
  padding: ${themeCssVariables.spacing[2]} ${themeCssVariables.spacing[3]};
  cursor: pointer;
  border-radius: ${themeCssVariables.border.radius.sm};
  margin: 0 ${themeCssVariables.spacing[1]};
  background: ${({ isSelected }: StyledRoomItemProps) =>
    isSelected
      ? themeCssVariables.background.transparent.medium
      : 'transparent'};
  transition: background 80ms ease;

  &:hover {
    background: ${themeCssVariables.background.transparent.light};
  }
`;

const StyledRoomAvatar = styled.div`
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: ${themeCssVariables.color.blue30};
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: ${themeCssVariables.font.size.xs};
  font-weight: ${themeCssVariables.font.weight.semiBold};
  color: ${themeCssVariables.color.blue50};
  flex-shrink: 0;
  font-family: ${themeCssVariables.font.family};
`;

const StyledRoomMeta = styled.div`
  display: flex;
  flex-direction: column;
  overflow: hidden;
  flex: 1 1 auto;
`;

const StyledRoomName = styled.span`
  font-size: ${themeCssVariables.font.size.sm};
  font-family: ${themeCssVariables.font.family};
  color: ${themeCssVariables.font.color.primary};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const StyledRoomLastMessage = styled.span`
  font-size: ${themeCssVariables.font.size.xs};
  font-family: ${themeCssVariables.font.family};
  color: ${themeCssVariables.font.color.tertiary};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const StyledUnreadBadge = styled.div`
  min-width: 18px;
  height: 18px;
  border-radius: 9px;
  background: ${themeCssVariables.color.blue50};
  color: #fff;
  font-size: 10px;
  font-weight: ${themeCssVariables.font.weight.semiBold};
  font-family: ${themeCssVariables.font.family};
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 4px;
  flex-shrink: 0;
`;

// ─── Component ────────────────────────────────────────────────────────────────

type InboxSidebarProps = {
  rooms: Room[];
  selectedRoomId: string | null;
  onSelectRoom: (roomId: string) => void;
};

export const InboxSidebar = ({
  rooms,
  selectedRoomId,
  onSelectRoom,
}: InboxSidebarProps) => {
  return (
    <StyledSidebar>
      <StyledSidebarHeader>Inbox</StyledSidebarHeader>
      <StyledRoomList>
        {rooms.map((room) => {
          const unreadCount = room.getUnreadNotificationCount();
          const lastEvent = room.timeline?.at(-1);
          const lastMessage =
            lastEvent?.getType() === 'm.room.message'
              ? (lastEvent.getContent().body as string) ?? ''
              : '';
          const displayName = room.name || 'Unnamed conversation';
          const avatarInitial = displayName.charAt(0).toUpperCase();

          return (
            <StyledRoomItem
              key={room.roomId}
              isSelected={room.roomId === selectedRoomId}
              onClick={() => onSelectRoom(room.roomId)}
            >
              <StyledRoomAvatar>{avatarInitial}</StyledRoomAvatar>
              <StyledRoomMeta>
                <StyledRoomName>{displayName}</StyledRoomName>
                {lastMessage && (
                  <StyledRoomLastMessage>{lastMessage}</StyledRoomLastMessage>
                )}
              </StyledRoomMeta>
              {unreadCount > 0 && (
                <StyledUnreadBadge>{unreadCount}</StyledUnreadBadge>
              )}
            </StyledRoomItem>
          );
        })}
        {rooms.length === 0 && (
          <StyledRoomItem isSelected={false}>
            <StyledRoomMeta>
              <StyledRoomLastMessage>No conversations yet</StyledRoomLastMessage>
            </StyledRoomMeta>
          </StyledRoomItem>
        )}
      </StyledRoomList>
    </StyledSidebar>
  );
};
