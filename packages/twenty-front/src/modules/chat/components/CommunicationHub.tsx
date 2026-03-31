import { useState, useEffect, useCallback } from 'react';
import { useAtomValue } from 'jotai';
import { styled } from '@linaria/react';
import { themeCssVariables } from 'twenty-ui/theme-constants';
import { Room, RoomEvent, MatrixEvent } from 'matrix-js-sdk';

import { matrixSyncedState } from '@/chat/states/matrixSessionState';
import { useMatrixClient } from '@/chat/hooks/useMatrixClient';
import { InboxSidebar } from '@/chat/components/InboxSidebar';
import { ConversationView } from '@/chat/components/ConversationView';

// ─── Layout shell — matches the CRM's own page layout conventions ─────────────

const StyledShell = styled.div`
  display: flex;
  flex-direction: row;
  flex: 1 1 auto;
  height: 100%;
  overflow: hidden;
  background: ${themeCssVariables.background.primary};
`;

const StyledNoSelection = styled.div`
  flex: 1 1 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.md};
  font-family: ${themeCssVariables.font.family};
`;

const StyledLoadingState = styled.div`
  flex: 1 1 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 12px;
  color: ${themeCssVariables.font.color.secondary};
  font-family: ${themeCssVariables.font.family};
  font-size: ${themeCssVariables.font.size.sm};
`;

/**
 * CommunicationHub
 *
 * The root page component for the /chat route.
 * Renders the native Matrix-powered communication interface.
 *
 * Structure:
 *  ┌──────────────────────────────────────────────────┐
 *  │ InboxSidebar (240px) │ ConversationView (flex: 1) │
 *  └──────────────────────────────────────────────────┘
 *
 * The SDK is initialized here via useMatrixClient, which watches the CRM auth
 * token and automatically provisions the user's Matrix account the first time.
 */
export const CommunicationHub = () => {
  const isSynced = useAtomValue(matrixSyncedState);
  const clientRef = useMatrixClient();
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);

  // Refresh room list on any room event (new message, membership change, etc.)
  const refreshRooms = useCallback(() => {
    if (!clientRef.current) return;
    setRooms(clientRef.current.getRooms());
  }, [clientRef]);

  useEffect(() => {
    if (!clientRef.current || !isSynced) return;

    // Initial room snapshot
    refreshRooms();

    // Subscribe to room events that should update the sidebar
    clientRef.current.on(RoomEvent.Timeline, refreshRooms);
    clientRef.current.on(RoomEvent.Name, refreshRooms);
    clientRef.current.on(RoomEvent.MyMembership, refreshRooms);

    return () => {
      clientRef.current?.off(RoomEvent.Timeline, refreshRooms);
      clientRef.current?.off(RoomEvent.Name, refreshRooms);
      clientRef.current?.off(RoomEvent.MyMembership, refreshRooms);
    };
  }, [isSynced, clientRef, refreshRooms]);

  if (!isSynced) {
    return (
      <StyledLoadingState>
        <span>Connecting to hub…</span>
      </StyledLoadingState>
    );
  }

  const selectedRoom = rooms.find((r) => r.roomId === selectedRoomId) ?? null;

  return (
    <StyledShell>
      <InboxSidebar
        rooms={rooms}
        selectedRoomId={selectedRoomId}
        onSelectRoom={setSelectedRoomId}
      />
      {selectedRoom ? (
        <ConversationView room={selectedRoom} client={clientRef.current!} />
      ) : (
        <StyledNoSelection>Select a conversation to start</StyledNoSelection>
      )}
    </StyledShell>
  );
};
