import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
} from 'react';
import { CreateChannelModal } from '@/chat/components/CreateChannelModal';
import { StreamDmModal } from '@/chat/components/StreamDmModal';
import { useChatWorkspaceLayout } from '@/chat/hooks/useChatWorkspaceLayout';
import { useAtomValue } from 'jotai';
import { useAuth as useClerkAuth } from '@clerk/clerk-react';
import { formatDistanceToNow } from 'date-fns';
import { motion } from 'framer-motion';
import {
  CallControls,
  SpeakerLayout,
  StreamCall,
  StreamVideo,
  StreamVideoClient,
  type Call,
} from '@stream-io/video-react-sdk';
import {
  StreamChat,
  type Channel as StreamChannel,
  type ChannelMemberResponse,
  type DefaultGenerics,
  type MessageResponse,
} from 'stream-chat';
import { Button, LightIconButton } from 'twenty-ui/input';
import {
  IconFileText,
  IconMessage,
  IconNotes,
  IconPaperclip,
  IconPhone,
  IconPlus,
  IconSearch,
  IconSend,
  IconUsers,
  IconWorld,
  IconX,
} from 'twenty-ui/display';
import { themeCssVariables } from 'twenty-ui/theme-constants';
import { styled } from '@linaria/react';

import { tokenPairState } from '@/auth/states/tokenPairState';
import { REACT_APP_STREAM_API_KEY } from '~/config';

import {
  HUB_QUICK_REACTION_TYPES,
} from '@/chat/constants/communicationHub.constants';
import { type ChatWorkspaceMemberOption } from '@/chat/types/chat-workspace-layout.type';
import { ensureStreamWorkspaceUsers } from '@/chat/utils/ensureStreamWorkspaceUsers';

import '@stream-io/video-react-sdk/dist/css/styles.css';

const QUICK_REACTION_SET = new Set<string>(
  HUB_QUICK_REACTION_TYPES as readonly string[],
);

function looksLikeScopedStreamId(id: string | undefined): boolean {
  return typeof id === 'string' && /^k[a-f0-9]{31}$/.test(id);
}

function labelForStreamUser(
  map: Map<string, string>,
  userId: string | undefined,
  streamName: string | undefined,
): string {
  if (userId && map.has(userId)) {
    return map.get(userId) as string;
  }
  const raw = streamName?.trim();
  if (raw && !looksLikeScopedStreamId(raw)) {
    return raw;
  }
  if (userId && looksLikeScopedStreamId(userId)) {
    return 'Member';
  }
  return raw || userId || 'Member';
}

type HubStatus = 'idle' | 'loading' | 'ready' | 'error';
type RailSection = 'channels' | 'dms';

type ConversationSummary = {
  avatarName: string;
  channel: StreamChannel<DefaultGenerics>;
  id: string;
  info: string;
  title: string;
  unreadCount: number;
};

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return '?';
  }
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function memberCount(channel: StreamChannel<DefaultGenerics>): number {
  return Object.keys(channel.state.members ?? {}).length;
}

function channelKind(
  channel: StreamChannel<DefaultGenerics>,
): 'dm' | 'channel' | 'unknown' {
  const raw = channel.data as { konnecctKind?: string } | undefined;
  const k = raw?.konnecctKind;
  if (k === 'dm') {
    return 'dm';
  }
  if (k === 'channel') {
    return 'channel';
  }
  return 'unknown';
}

function isLikelyDm(channel: StreamChannel<DefaultGenerics>): boolean {
  const k = channelKind(channel);
  if (k === 'dm') {
    return true;
  }
  if (k === 'channel') {
    return false;
  }
  return memberCount(channel) <= 2;
}

const StyledShell = styled.div`
  background: ${themeCssVariables.background.primary};
  display: flex;
  flex: 1 1 auto;
  height: 100%;
  min-height: 0;
`;

const StyledCenterState = styled.div`
  align-items: center;
  color: ${themeCssVariables.font.color.secondary};
  display: flex;
  flex: 1 1 auto;
  font-family: ${themeCssVariables.font.family};
  font-size: ${themeCssVariables.font.size.md};
  justify-content: center;
  padding: 24px;
  text-align: center;
`;

const StyledError = styled(StyledCenterState)`
  color: ${themeCssVariables.color.red};
`;

const StyledHub = styled.div`
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: 12px;
  display: flex;
  flex: 1 1 auto;
  font-family: ${themeCssVariables.font.family};
  min-height: 0;
  overflow: hidden;
`;

const StyledRail = styled.nav`
  align-items: center;
  background: ${themeCssVariables.background.secondary};
  border-right: 1px solid ${themeCssVariables.border.color.medium};
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  gap: 8px;
  padding: 12px 8px;
  width: 56px;
`;

const StyledRailButton = styled.button<{ $active?: boolean }>`
  align-items: center;
  background: ${({ $active }) =>
    $active
      ? themeCssVariables.background.transparent.blue
      : 'transparent'};
  border: none;
  border-radius: 10px;
  color: ${themeCssVariables.font.color.primary};
  cursor: pointer;
  display: flex;
  height: 44px;
  justify-content: center;
  position: relative;
  width: 44px;

  &:hover {
    background: ${themeCssVariables.background.transparent.light};
  }
`;

const StyledRailBadge = styled.span`
  align-items: center;
  background: ${themeCssVariables.color.blue};
  border-radius: 10px;
  color: ${themeCssVariables.font.color.inverted};
  display: flex;
  font-size: 10px;
  font-weight: 600;
  justify-content: center;
  min-width: 18px;
  padding: 0 5px;
  position: absolute;
  right: 2px;
  top: 2px;
`;

const StyledListPanel = styled.aside`
  background: ${themeCssVariables.background.primary};
  border-right: 1px solid ${themeCssVariables.border.color.medium};
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  min-height: 0;
  width: 300px;

  @media (max-width: 768px) {
    width: 100%;
  }
`;

const StyledListHeader = styled.div`
  border-bottom: 1px solid ${themeCssVariables.border.color.medium};
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px 14px 12px;
`;

const StyledListTitle = styled.span`
  color: ${themeCssVariables.font.color.primary};
  font-size: ${themeCssVariables.font.size.md};
  font-weight: ${themeCssVariables.font.weight.semiBold};
`;

const StyledSearchWrap = styled.div`
  position: relative;
`;

const StyledSearchIcon = styled.div`
  color: ${themeCssVariables.font.color.tertiary};
  left: 10px;
  pointer-events: none;
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
`;

const StyledSearchInput = styled.input`
  background: ${themeCssVariables.background.secondary};
  border: 1px solid transparent;
  border-radius: 8px;
  box-sizing: border-box;
  color: ${themeCssVariables.font.color.primary};
  font-family: ${themeCssVariables.font.family};
  font-size: ${themeCssVariables.font.size.sm};
  height: 36px;
  outline: none;
  padding: 0 12px 0 36px;
  width: 100%;

  &::placeholder {
    color: ${themeCssVariables.font.color.tertiary};
  }

  &:focus {
    border-color: ${themeCssVariables.border.color.strong};
  }
`;

const StyledListScroll = styled.div`
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
`;

const StyledListRow = styled.button<{ $active?: boolean }>`
  align-items: center;
  background: ${({ $active }) =>
    $active ? themeCssVariables.background.secondary : 'transparent'};
  border: none;
  border-bottom: 1px solid ${themeCssVariables.border.color.light};
  color: inherit;
  cursor: pointer;
  display: flex;
  gap: 12px;
  padding: 12px 14px;
  text-align: left;
  width: 100%;

  &:hover {
    background: ${themeCssVariables.background.secondary};
  }
`;

const StyledAvatar = styled.div`
  align-items: center;
  background: ${themeCssVariables.background.transparent.blue};
  border-radius: 50%;
  color: ${themeCssVariables.color.blue};
  display: flex;
  flex-shrink: 0;
  font-size: ${themeCssVariables.font.size.sm};
  font-weight: ${themeCssVariables.font.weight.semiBold};
  height: 40px;
  justify-content: center;
  width: 40px;
`;

const StyledRowBody = styled.div`
  flex: 1 1 auto;
  min-width: 0;
`;

const StyledRowTop = styled.div`
  align-items: baseline;
  display: flex;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 2px;
`;

const StyledRowName = styled.span`
  color: ${themeCssVariables.font.color.primary};
  font-size: ${themeCssVariables.font.size.sm};
  font-weight: ${themeCssVariables.font.weight.medium};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const StyledRowTime = styled.span`
  color: ${themeCssVariables.font.color.tertiary};
  flex-shrink: 0;
  font-size: 11px;
`;

const StyledRowPreview = styled.div`
  align-items: center;
  display: flex;
  justify-content: space-between;
  gap: 8px;
`;

const StyledRowInfo = styled.p`
  color: ${themeCssVariables.font.color.secondary};
  font-size: ${themeCssVariables.font.size.sm};
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const StyledUnreadDot = styled.span`
  background: ${themeCssVariables.color.blue};
  border-radius: 10px;
  color: ${themeCssVariables.font.color.inverted};
  flex-shrink: 0;
  font-size: 10px;
  font-weight: 700;
  min-width: 20px;
  padding: 2px 7px;
  text-align: center;
`;

const StyledMain = styled.main`
  background: ${themeCssVariables.background.primary};
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-width: 0;
  position: relative;
`;

const StyledMainHeader = styled.header`
  align-items: center;
  backdrop-filter: blur(8px);
  background: ${themeCssVariables.background.primary};
  border-bottom: 1px solid ${themeCssVariables.border.color.medium};
  display: flex;
  flex-shrink: 0;
  justify-content: space-between;
  min-height: 56px;
  padding: 0 16px;
`;

const StyledHeaderLeft = styled.div`
  align-items: center;
  display: flex;
  gap: 10px;
  min-width: 0;
`;

const StyledHeaderTitles = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
`;

const StyledHeaderName = styled.span`
  color: ${themeCssVariables.font.color.primary};
  font-size: ${themeCssVariables.font.size.md};
  font-weight: ${themeCssVariables.font.weight.semiBold};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const StyledHeaderMeta = styled.span`
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.sm};
`;

const StyledHeaderActions = styled.div`
  align-items: center;
  display: flex;
  flex-shrink: 0;
  gap: 8px;
`;

const StyledMessages = styled.div`
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  padding: 16px;
  scroll-behavior: smooth;
`;

const StyledMessageRow = styled.div<{ $own?: boolean }>`
  display: flex;
  flex-direction: ${({ $own }) => ($own ? 'row-reverse' : 'row')};
  gap: 10px;
`;

const StyledMsgAvatar = styled.div`
  align-items: center;
  background: ${themeCssVariables.background.secondary};
  border-radius: 50%;
  color: ${themeCssVariables.font.color.secondary};
  display: flex;
  flex-shrink: 0;
  font-size: 11px;
  font-weight: 600;
  height: 32px;
  justify-content: center;
  width: 32px;
`;

const StyledMsgCol = styled.div<{ $own?: boolean }>`
  align-items: ${({ $own }) => ($own ? 'flex-end' : 'flex-start')};
  display: flex;
  flex-direction: column;
  min-width: 0;
`;

const StyledMsgMeta = styled.div<{ $own?: boolean }>`
  align-items: center;
  display: flex;
  flex-direction: ${({ $own }) => ($own ? 'row-reverse' : 'row')};
  gap: 8px;
  margin-bottom: 4px;
`;

const StyledMsgAuthor = styled.span`
  color: ${themeCssVariables.font.color.primary};
  font-size: ${themeCssVariables.font.size.sm};
  font-weight: ${themeCssVariables.font.weight.medium};
  max-width: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const StyledMsgTime = styled.span`
  color: ${themeCssVariables.font.color.tertiary};
  font-size: 11px;
`;

const StyledMessageWrap = styled.div<{ $own?: boolean }>`
  margin-bottom: 14px;
  max-width: 85%;
  ${({ $own }) => ($own ? 'margin-left: auto;' : '')}

  &:hover .hub-react-bar {
    opacity: 1;
  }
`;

const StyledReactionBar = styled.div`
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 6px;
  opacity: 0;
  transition: opacity 0.12s ease;
`;

const StyledReactionChip = styled.button`
  background: ${themeCssVariables.background.secondary};
  border: 1px solid ${themeCssVariables.border.color.light};
  border-radius: 12px;
  color: ${themeCssVariables.font.color.secondary};
  cursor: pointer;
  font-size: 12px;
  padding: 2px 8px;

  &:hover {
    border-color: ${themeCssVariables.border.color.medium};
  }
`;

const StyledThreadHint = styled.button`
  background: transparent;
  border: none;
  color: ${themeCssVariables.color.blue};
  cursor: pointer;
  font-size: 11px;
  margin-top: 6px;
  padding: 0;
  text-align: inherit;

  &:hover {
    text-decoration: underline;
  }
`;

const StyledThreadDrawer = styled.div`
  border-top: 1px solid ${themeCssVariables.border.color.medium};
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  max-height: 42vh;
  min-height: 120px;
`;

const StyledThreadHeader = styled.div`
  align-items: center;
  border-bottom: 1px solid ${themeCssVariables.border.color.light};
  display: flex;
  flex-shrink: 0;
  justify-content: space-between;
  padding: 8px 12px;
`;

const StyledThreadScroll = styled.div`
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  padding: 8px 12px;
`;

const StyledThreadComposerBar = styled.div`
  align-items: flex-end;
  background: ${themeCssVariables.background.primary};
  border-top: 1px solid ${themeCssVariables.border.color.medium};
  display: flex;
  flex-shrink: 0;
  gap: 6px;
  padding: 8px 12px;
`;

const StyledResizeHandle = styled.div`
  cursor: col-resize;
  flex-shrink: 0;
  padding: 0 4px;
  width: 8px;

  &::before {
    background: ${themeCssVariables.border.color.medium};
    border-radius: 2px;
    content: '';
    display: block;
    height: 40px;
    margin-top: 40px;
    width: 3px;
  }

  &:hover::before {
    background: ${themeCssVariables.color.blue};
  }
`;

const StyledBubble = styled.div<{ $own?: boolean }>`
  background: ${({ $own }) =>
    $own
      ? themeCssVariables.accent.primary
      : themeCssVariables.background.secondary};
  border-radius: 16px;
  border-bottom-left-radius: ${({ $own }) => ($own ? '16px' : '4px')};
  border-bottom-right-radius: ${({ $own }) => ($own ? '4px' : '16px')};
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
  color: ${({ $own }) =>
    $own
      ? themeCssVariables.font.color.inverted
      : themeCssVariables.font.color.primary};
  font-size: ${themeCssVariables.font.size.sm};
  line-height: 1.45;
  padding: 10px 14px;
  word-break: break-word;
`;

const StyledAttachmentImg = styled.img`
  border-radius: 10px;
  display: block;
  margin-bottom: 8px;
  max-height: 220px;
  max-width: 100%;
  object-fit: cover;
`;

const StyledComposer = styled.div`
  border-top: 1px solid ${themeCssVariables.border.color.medium};
  flex-shrink: 0;
  padding: 12px 16px 16px;
`;

const StyledComposerInner = styled.div`
  align-items: flex-end;
  background: ${themeCssVariables.background.secondary};
  border-radius: 12px;
  display: flex;
  flex: 1 1 auto;
  gap: 6px;
  min-width: 0;
  padding: 6px 10px;
  position: relative;
`;

const StyledComposerFieldWrap = styled.div`
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-width: 0;
  position: relative;
`;

const StyledMentionPopover = styled.ul`
  background: ${themeCssVariables.background.primary};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: 8px;
  bottom: 100%;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
  left: 0;
  list-style: none;
  margin: 0 0 6px;
  max-height: 200px;
  overflow-y: auto;
  padding: 4px;
  position: absolute;
  right: 0;
  z-index: 20;
`;

const StyledMentionItem = styled.li<{ $active?: boolean }>`
  border-radius: 6px;
  cursor: pointer;
  font-size: ${themeCssVariables.font.size.sm};
  padding: 6px 8px;
  background: ${({ $active }) =>
    $active ? themeCssVariables.background.transparent.blue : 'transparent'};
  color: ${themeCssVariables.font.color.primary};

  &:hover {
    background: ${themeCssVariables.background.transparent.blue};
  }
`;

const StyledGlobalSearchBackdrop = styled.div`
  align-items: center;
  background: rgba(0, 0, 0, 0.35);
  display: flex;
  inset: 0;
  justify-content: center;
  padding: 24px;
  position: fixed;
  z-index: 1000;
`;

const StyledGlobalSearchModal = styled.div`
  background: ${themeCssVariables.background.primary};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: 12px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.18);
  display: flex;
  flex-direction: column;
  max-height: min(480px, 80vh);
  max-width: 520px;
  width: 100%;
`;

const StyledGlobalSearchHeader = styled.div`
  border-bottom: 1px solid ${themeCssVariables.border.color.light};
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 14px;
`;

const StyledGlobalSearchInput = styled.input`
  background: ${themeCssVariables.background.secondary};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: 8px;
  color: ${themeCssVariables.font.color.primary};
  font-family: ${themeCssVariables.font.family};
  font-size: ${themeCssVariables.font.size.sm};
  outline: none;
  padding: 8px 10px;
  width: 100%;

  &::placeholder {
    color: ${themeCssVariables.font.color.tertiary};
  }
`;

const StyledGlobalSearchScroll = styled.div`
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  padding: 8px;
`;

const StyledGlobalSearchHit = styled.button`
  background: transparent;
  border: none;
  border-radius: 8px;
  color: ${themeCssVariables.font.color.primary};
  cursor: pointer;
  display: block;
  font-family: ${themeCssVariables.font.family};
  font-size: ${themeCssVariables.font.size.sm};
  padding: 8px 10px;
  text-align: left;
  width: 100%;

  &:hover {
    background: ${themeCssVariables.background.transparent.blue};
  }
`;

const StyledGlobalSearchHitMeta = styled.div`
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.xs};
  margin-top: 2px;
`;

const StyledComposerInput = styled.textarea`
  background: transparent;
  border: none;
  color: ${themeCssVariables.font.color.primary};
  flex: 1 1 auto;
  font-family: ${themeCssVariables.font.family};
  font-size: ${themeCssVariables.font.size.sm};
  line-height: 1.4;
  max-height: 160px;
  min-height: 22px;
  min-width: 0;
  outline: none;
  resize: none;

  &::placeholder {
    color: ${themeCssVariables.font.color.tertiary};
  }
`;

const StyledTyping = styled.div`
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.sm};
  padding: 0 16px 8px;
`;

const StyledEmpty = styled.div`
  align-items: center;
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  justify-content: center;
  padding: 32px;
  text-align: center;
`;

const StyledEmptyIcon = styled.div`
  align-items: center;
  background: ${themeCssVariables.background.transparent.blue};
  border: 1px solid ${themeCssVariables.border.color.light};
  border-radius: 16px;
  display: flex;
  height: 72px;
  justify-content: center;
  margin-bottom: 20px;
  width: 72px;
`;

const StyledEmptyTitle = styled.h3`
  color: ${themeCssVariables.font.color.primary};
  font-size: ${themeCssVariables.font.size.lg};
  font-weight: ${themeCssVariables.font.weight.semiBold};
  margin: 0 0 8px;
`;

const StyledEmptyText = styled.p`
  color: ${themeCssVariables.font.color.secondary};
  font-size: ${themeCssVariables.font.size.sm};
  line-height: 1.5;
  margin: 0 0 24px;
  max-width: 320px;
`;

const StyledEmptyActions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  justify-content: center;
`;

const StyledCallWrapper = styled.div`
  border-top: 1px solid ${themeCssVariables.border.color.medium};
  height: 300px;
`;

const StyledMiniCallBar = styled.div`
  align-items: center;
  background: ${themeCssVariables.background.secondary};
  border-top: 1px solid ${themeCssVariables.border.color.medium};
  bottom: 0;
  display: flex;
  flex-shrink: 0;
  gap: 10px;
  justify-content: space-between;
  left: 0;
  padding: 10px 16px;
  position: absolute;
  right: 0;
  z-index: 30;
`;

const StyledJoiningBanner = styled.div`
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.sm};
  padding: 0 8px;
`;

const StyledAddRow = styled.button`
  align-items: center;
  background: transparent;
  border: none;
  color: ${themeCssVariables.font.color.tertiary};
  cursor: pointer;
  display: flex;
  font-family: ${themeCssVariables.font.family};
  font-size: ${themeCssVariables.font.size.sm};
  gap: 8px;
  padding: 10px 14px;
  text-align: left;
  width: 100%;

  &:hover {
    background: ${themeCssVariables.background.secondary};
    color: ${themeCssVariables.font.color.primary};
  }
`;

const StyledMainStage = styled.div`
  display: flex;
  flex: 1 1 auto;
  min-height: 0;
  min-width: 0;
  position: relative;
`;

const StyledRightPanel = styled.aside<{ $mobileOpen?: boolean; $width: number }>`
  background: ${themeCssVariables.background.secondary};
  border-left: 1px solid ${themeCssVariables.border.color.medium};
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  min-height: 0;
  width: ${({ $width }) => $width}px;

  @media (max-width: 900px) {
    border-left: none;
    box-shadow: -4px 0 24px rgba(0, 0, 0, 0.12);
    bottom: 0;
    position: absolute;
    right: 0;
    top: 0;
    transform: translateX(${({ $mobileOpen }) => ($mobileOpen ? '0' : '100%')});
    transition: transform 0.2s ease;
    width: min(320px, 92vw);
    z-index: 20;
  }
`;

const StyledRightPanelBackdrop = styled.button`
  background: rgba(0, 0, 0, 0.25);
  border: none;
  bottom: 0;
  cursor: pointer;
  display: none;
  left: 0;
  padding: 0;
  position: absolute;
  right: 0;
  top: 0;
  z-index: 15;

  @media (max-width: 900px) {
    display: block;
  }
`;

const StyledPanelTabRow = styled.div`
  border-bottom: 1px solid ${themeCssVariables.border.color.medium};
  display: flex;
  flex-shrink: 0;
  gap: 4px;
  padding: 8px;
`;

const StyledPanelTab = styled.button<{ $active?: boolean }>`
  background: ${({ $active }) =>
    $active
      ? themeCssVariables.background.transparent.blue
      : 'transparent'};
  border: none;
  border-radius: 8px;
  color: ${({ $active }) =>
    $active
      ? themeCssVariables.color.blue
      : themeCssVariables.font.color.secondary};
  cursor: pointer;
  flex: 1 1 0;
  font-family: ${themeCssVariables.font.family};
  font-size: ${themeCssVariables.font.size.sm};
  font-weight: ${themeCssVariables.font.weight.medium};
  padding: 8px 6px;

  &:hover {
    background: ${themeCssVariables.background.transparent.light};
  }
`;

const StyledPanelBody = styled.div`
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
`;

const StyledPanelScroll = styled.div`
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  padding: 8px 12px 12px;
`;

const StyledMemberRow = styled.div`
  align-items: center;
  border-bottom: 1px solid ${themeCssVariables.border.color.light};
  display: flex;
  gap: 10px;
  padding: 10px 0;
`;

const StyledMemberAvatar = styled.div`
  align-items: center;
  background: ${themeCssVariables.background.transparent.blue};
  border-radius: 50%;
  color: ${themeCssVariables.color.blue};
  display: flex;
  flex-shrink: 0;
  font-size: 11px;
  font-weight: 600;
  height: 32px;
  justify-content: center;
  width: 32px;
`;

const StyledMemberName = styled.span`
  color: ${themeCssVariables.font.color.primary};
  font-size: ${themeCssVariables.font.size.sm};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const StyledSearchInChatInput = styled.input`
  background: ${themeCssVariables.background.primary};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: 8px;
  box-sizing: border-box;
  color: ${themeCssVariables.font.color.primary};
  font-family: ${themeCssVariables.font.family};
  font-size: ${themeCssVariables.font.size.sm};
  margin: 0 12px 8px;
  outline: none;
  padding: 8px 10px;
  width: calc(100% - 24px);

  &:focus {
    border-color: ${themeCssVariables.border.color.strong};
  }
`;

const StyledSearchHit = styled.button`
  background: transparent;
  border: none;
  border-radius: 8px;
  color: ${themeCssVariables.font.color.primary};
  cursor: pointer;
  display: block;
  font-family: ${themeCssVariables.font.family};
  font-size: ${themeCssVariables.font.size.sm};
  padding: 8px 4px;
  text-align: left;
  width: 100%;

  &:hover {
    background: ${themeCssVariables.background.transparent.light};
  }
`;

const StyledSearchHitMeta = styled.span`
  color: ${themeCssVariables.font.color.tertiary};
  display: block;
  font-size: 11px;
  margin-bottom: 4px;
`;

const StyledFileChip = styled.div`
  align-items: center;
  background: ${themeCssVariables.background.primary};
  border-radius: 8px;
  display: flex;
  gap: 8px;
  margin: 0 16px 8px;
  max-width: calc(100% - 32px);
  padding: 6px 10px;
`;

const StyledFileChipName = styled.span`
  color: ${themeCssVariables.font.color.primary};
  flex: 1 1 auto;
  font-size: ${themeCssVariables.font.size.sm};
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const StyledFileLink = styled.a`
  color: ${themeCssVariables.color.blue};
  display: inline-flex;
  font-size: ${themeCssVariables.font.size.sm};
  gap: 6px;
  margin-top: 8px;
  word-break: break-all;
`;

const StyledMutedHelp = styled.span`
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.sm};
`;

export const CommunicationHub = () => {
  const tokenPair = useAtomValue(tokenPairState.atom);
  const crmToken = tokenPair?.accessOrWorkspaceAgnosticToken?.token;
  const { getToken: getClerkToken, orgId: clerkOrgId, userId: clerkUserId } =
    useClerkAuth();

  const [status, setStatus] = useState<HubStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [streamClient, setStreamClient] = useState<StreamChat>();
  const [streamVideoClient, setStreamVideoClient] = useState<StreamVideoClient>();
  const [conversationSummaries, setConversationSummaries] = useState<
    ConversationSummary[]
  >([]);
  const [activeChannel, setActiveChannel] = useState<
    StreamChannel<DefaultGenerics> | undefined
  >();
  const [channelMessages, setChannelMessages] = useState<
    MessageResponse<DefaultGenerics>[]
  >([]);
  const [draft, setDraft] = useState('');
  const [composerSending, setComposerSending] = useState(false);
  const [typingText, setTypingText] = useState<string | null>(null);
  const [activeCall, setActiveCall] = useState<Call | undefined>();
  const [isCallPanelOpen, setIsCallPanelOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<RailSection>('channels');
  const [listSearch, setListSearch] = useState('');
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeChannelRef = useRef<StreamChannel<DefaultGenerics> | undefined>(
    undefined,
  );
  const streamInitGenerationRef = useRef(0);

  const { layout, reload: reloadChatLayout } = useChatWorkspaceLayout();
  const [createChannelOpen, setCreateChannelOpen] = useState(false);
  const [dmModalOpen, setDmModalOpen] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [isNarrowViewport, setIsNarrowViewport] = useState(false);
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  const [rightPanelMobileOpen, setRightPanelMobileOpen] = useState(false);
  const [rightPanelTab, setRightPanelTab] = useState<'members' | 'search'>(
    'members',
  );
  const [inChatSearch, setInChatSearch] = useState('');
  const [searchRemoteHits, setSearchRemoteHits] = useState<
    { message: MessageResponse }[]
  >([]);
  const [searchRemoteLoading, setSearchRemoteLoading] = useState(false);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const messagesScrollRef = useRef<HTMLDivElement>(null);
  const loadingOlderRef = useRef(false);
  const [threadRoot, setThreadRoot] = useState<MessageResponse | null>(null);
  const [threadReplies, setThreadReplies] = useState<MessageResponse[]>([]);
  const threadRootRef = useRef<MessageResponse | null>(null);
  const [threadDraft, setThreadDraft] = useState('');
  const [threadSending, setThreadSending] = useState(false);
  const [rightPanelWidth, setRightPanelWidth] = useState(280);
  const resizeDragRef = useRef<{
    startX: number;
    startWidth: number;
  } | null>(null);
  const listSearchInputRef = useRef<HTMLInputElement>(null);
  const [callMinimized, setCallMinimized] = useState(false);
  const [joiningCall, setJoiningCall] = useState(false);
  const [composerMention, setComposerMention] = useState<
    | {
        query: string;
        replaceFrom: number;
        replaceTo: number;
      }
    | null
  >(null);
  const [mentionHighlightIndex, setMentionHighlightIndex] = useState(0);
  const [globalSearchOpen, setGlobalSearchOpen] = useState(false);
  const [globalQuery, setGlobalQuery] = useState('');
  const [globalHits, setGlobalHits] = useState<
    { message: MessageResponse }[]
  >([]);
  const [globalSearchLoading, setGlobalSearchLoading] = useState(false);
  const pendingMentionUserIdsRef = useRef<Set<string>>(new Set());
  const composerTextareaRef = useRef<HTMLTextAreaElement>(null);
  const [threadComposerMention, setThreadComposerMention] = useState<
    | {
        query: string;
        replaceFrom: number;
        replaceTo: number;
      }
    | null
  >(null);
  const [threadMentionHighlightIndex, setThreadMentionHighlightIndex] =
    useState(0);
  const pendingThreadMentionUserIdsRef = useRef<Set<string>>(new Set());
  const threadTextareaRef = useRef<HTMLTextAreaElement>(null);
  const globalSearchInputRef = useRef<HTMLInputElement>(null);
  const globalSearchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const [workspaceChatMembers, setWorkspaceChatMembers] = useState<
    ChatWorkspaceMemberOption[]
  >([]);

  const fallbackUid = useMemo(
    () => clerkUserId ?? 'stream-uid-1',
    [clerkUserId],
  );

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 900px)');
    const apply = () => {
      const narrow = mq.matches;
      setIsNarrowViewport(narrow);
      setRightPanelOpen(!narrow);
      if (!narrow) {
        setRightPanelMobileOpen(false);
      }
    };
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  useEffect(() => {
    threadRootRef.current = threadRoot;
  }, [threadRoot]);

  useEffect(() => {
    setThreadDraft('');
    setThreadComposerMention(null);
    pendingThreadMentionUserIdsRef.current.clear();
    setThreadMentionHighlightIndex(0);
  }, [threadRoot?.id]);

  useEffect(() => {
    if (globalSearchOpen) {
      requestAnimationFrame(() => {
        globalSearchInputRef.current?.focus();
        globalSearchInputRef.current?.select();
      });
    }
  }, [globalSearchOpen]);

  useEffect(() => {
    if (activeChannel) {
      setRightPanelTab('members');
      setInChatSearch('');
      setSearchRemoteHits([]);
      setThreadRoot(null);
      setThreadReplies([]);
      setComposerMention(null);
      pendingMentionUserIdsRef.current.clear();
    }
  }, [activeChannel?.cid]);

  useEffect(() => {
    if (!crmToken) {
      setWorkspaceChatMembers([]);
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const response = await fetch('/chat/workspace-members', {
          headers: { Authorization: `Bearer ${crmToken}` },
        });

        if (!response.ok) {
          throw new Error(await response.text());
        }

        const data = (await response.json()) as ChatWorkspaceMemberOption[];

        if (!cancelled) {
          setWorkspaceChatMembers(Array.isArray(data) ? data : []);
        }
      } catch {
        if (!cancelled) {
          setWorkspaceChatMembers([]);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [crmToken]);

  useEffect(() => {
    if (!activeChannel || !threadRoot?.id) {
      setThreadReplies([]);
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const res = await activeChannel.getReplies(threadRoot.id, {
          limit: 80,
        });
        if (!cancelled) {
          setThreadReplies(res.messages ?? []);
        }
      } catch {
        if (!cancelled) {
          setThreadReplies([]);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeChannel, threadRoot?.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      const inField =
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        tag === 'SELECT' ||
        target?.isContentEditable;

      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        listSearchInputRef.current?.focus();
        return;
      }

      if (
        (e.metaKey || e.ctrlKey) &&
        e.shiftKey &&
        (e.key === 'k' || e.key === 'K')
      ) {
        e.preventDefault();
        setGlobalSearchOpen(true);
        return;
      }

      if (e.key === 'Escape') {
        setRightPanelMobileOpen(false);
        setThreadRoot(null);
        setDmModalOpen(false);
        setCreateChannelOpen(false);
        setGlobalSearchOpen(false);
      }

      if (!inField && e.key === 'g' && e.altKey) {
        e.preventDefault();
        setActiveSection('channels');
      }

      if (!inField && e.key === 'd' && e.altKey) {
        e.preventDefault();
        setActiveSection('dms');
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (!activeChannel || rightPanelTab !== 'search') {
      return;
    }

    const q = inChatSearch.trim();

    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }

    if (q.length < 2) {
      setSearchRemoteHits([]);
      setSearchRemoteLoading(false);
      return;
    }

    setSearchRemoteLoading(true);
    searchDebounceRef.current = setTimeout(() => {
      void (async () => {
        try {
          const res = await activeChannel.search(q, { limit: 30 });
          setSearchRemoteHits(res.results ?? []);
        } catch {
          setSearchRemoteHits([]);
        } finally {
          setSearchRemoteLoading(false);
        }
      })();
    }, 400);

    return () => {
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
      }
    };
  }, [activeChannel, inChatSearch, rightPanelTab]);

  useEffect(() => {
    if (!streamClient || !globalSearchOpen) {
      return;
    }

    const q = globalQuery.trim();

    if (globalSearchDebounceRef.current) {
      clearTimeout(globalSearchDebounceRef.current);
    }

    if (q.length < 2) {
      setGlobalHits([]);
      setGlobalSearchLoading(false);
      return;
    }

    const selfId = streamClient.userID ?? fallbackUid;
    setGlobalSearchLoading(true);
    globalSearchDebounceRef.current = setTimeout(() => {
      void (async () => {
        try {
          const res = await streamClient.search(
            {
              members: { $in: [selfId] },
              type: 'messaging',
            },
            q,
            { limit: 30 },
          );
          setGlobalHits(res.results ?? []);
        } catch {
          setGlobalHits([]);
        } finally {
          setGlobalSearchLoading(false);
        }
      })();
    }, 400);

    return () => {
      if (globalSearchDebounceRef.current) {
        clearTimeout(globalSearchDebounceRef.current);
      }
    };
  }, [fallbackUid, globalQuery, globalSearchOpen, streamClient]);

  const toSummary = useCallback(
    (
      channel: StreamChannel<DefaultGenerics>,
      client: StreamChat,
    ): ConversationSummary => {
      const selfId = client.userID ?? fallbackUid;
      const members = Object.values(channel.state.members ?? {});
      const otherMember = members.find((member) => member.user?.id !== selfId);
      const fallbackTitle = channel.data?.name ?? otherMember?.user?.name;
      const title =
        typeof fallbackTitle === 'string' && fallbackTitle.trim() !== ''
          ? fallbackTitle
          : otherMember?.user?.id ?? 'Conversation';
      const lastMessage =
        channel.state.messages[channel.state.messages.length - 1];
      const info =
        typeof lastMessage?.text === 'string' && lastMessage.text.trim() !== ''
          ? lastMessage.text
          : 'No messages yet';

      return {
        avatarName: title,
        channel,
        id: channel.cid,
        info,
        title,
        unreadCount: channel.countUnread() ?? 0,
      };
    },
    [fallbackUid],
  );

  const refreshConversations = useCallback(
    async (client: StreamChat) => {
      const selfId = client.userID ?? fallbackUid;
      const channels = await client.queryChannels(
        {
          members: { $in: [selfId] },
          type: 'messaging',
        },
        { last_message_at: -1 },
        { presence: true, state: true, watch: true },
      );

      const next = channels.map((ch) => toSummary(ch, client));

      setConversationSummaries(next);

      const hasActive = next.some((c) => c.id === activeChannelRef.current?.cid);
      if (!hasActive && next[0]) {
        activeChannelRef.current = next[0].channel;
        setActiveChannel(next[0].channel);
      }
    },
    [fallbackUid, toSummary],
  );

  useEffect(() => {
    if (!streamClient) {
      return;
    }

    const sub = streamClient.on('connection.recovered', () => {
      void refreshConversations(streamClient);
      const ch = activeChannelRef.current;
      if (ch) {
        void ch.watch();
        setChannelMessages([...ch.state.messages]);
      }
    });

    return () => {
      sub.unsubscribe();
    };
  }, [refreshConversations, streamClient]);

  useEffect(() => {
    const initGeneration = ++streamInitGenerationRef.current;
    let chatClientForCleanup: StreamChat | null = null;
    let videoClientForCleanup: StreamVideoClient | null = null;

    const isInitStale = () => initGeneration !== streamInitGenerationRef.current;

    const init = async () => {
      setStatus('loading');

      try {
        const bearer = crmToken ?? (await getClerkToken());

        if (!bearer) {
          throw new Error('Missing auth token for Stream session bootstrap.');
        }

        if (isInitStale()) {
          return;
        }

        const response = await fetch('/stream/token', {
          headers: {
            Authorization: `Bearer ${bearer}`,
            ...(clerkOrgId ? { 'X-Clerk-Org-Id': clerkOrgId } : {}),
            'X-Konnecct-Uid-Fallback': fallbackUid,
          },
        });

        if (!response.ok) {
          const raw = await response.text();
          throw new Error(raw || `Token endpoint failed with ${response.status}`);
        }

        const { apiKey, token, userId } = (await response.json()) as {
          apiKey?: string;
          token: string;
          userId: string;
        };
        const resolvedApiKey = REACT_APP_STREAM_API_KEY || apiKey;

        if (!resolvedApiKey) {
          throw new Error(
            'Stream API key missing from frontend config and token response.',
          );
        }

        const user = {
          id: userId,
          name: userId,
        };

        const chatClient = StreamChat.getInstance(resolvedApiKey);
        chatClientForCleanup = chatClient;

        await chatClient.connectUser(user, token);

        if (isInitStale()) {
          await chatClient.disconnectUser();
          return;
        }

        await refreshConversations(chatClient);

        if (isInitStale()) {
          await chatClient.disconnectUser();
          return;
        }

        const videoClient = StreamVideoClient.getOrCreateInstance({
          apiKey: resolvedApiKey,
          token,
          user,
        });
        videoClientForCleanup = videoClient;

        if (isInitStale()) {
          await chatClient.disconnectUser();
          videoClient.disconnectUser();
          return;
        }

        setStreamClient(chatClient);
        setStreamVideoClient(videoClient);
        setStatus('ready');
      } catch (error) {
        if (isInitStale()) {
          return;
        }

        setStatus('error');
        setErrorMessage(error instanceof Error ? error.message : String(error));
      }
    };

    void init();

    return () => {
      streamInitGenerationRef.current += 1;
      setIsCallPanelOpen(false);
      setActiveCall(undefined);
      activeChannelRef.current = undefined;
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      videoClientForCleanup?.disconnectUser();
      void chatClientForCleanup?.disconnectUser();
    };
  }, [
    clerkOrgId,
    crmToken,
    fallbackUid,
    getClerkToken,
    refreshConversations,
  ]);

  useEffect(() => {
    activeChannelRef.current = activeChannel;
    if (!activeChannel) {
      setChannelMessages([]);
      setTypingText(null);
      return;
    }

    setChannelMessages([...activeChannel.state.messages]);
    void activeChannel.markRead().catch(() => {});
  }, [activeChannel]);

  useEffect(() => {
    if (!streamClient) {
      return;
    }

    const subscription = streamClient.on((event) => {
      if (
        event.type === 'message.new' ||
        event.type === 'notification.message_new' ||
        event.type === 'notification.added_to_channel' ||
        event.type === 'notification.mark_read'
      ) {
        void refreshConversations(streamClient);
      }

      const current = activeChannelRef.current;
      if (!current || event.cid !== current.cid) {
        return;
      }

      if (
        event.type === 'message.new' &&
        event.message &&
        'parent_id' in event.message &&
        event.message.parent_id &&
        event.message.parent_id === threadRootRef.current?.id
      ) {
        void current
          .getReplies(event.message.parent_id, { limit: 80 })
          .then((r) => {
            setThreadReplies(r.messages ?? []);
          })
          .catch(() => {});
      }

      if (
        event.type === 'message.new' ||
        event.type === 'message.updated' ||
        event.type === 'message.deleted' ||
        event.type === 'notification.mark_read'
      ) {
        setChannelMessages([...current.state.messages]);
      }

      if (event.type === 'typing.start' || event.type === 'typing.stop') {
        const typers = Object.values(current.state.typing ?? {})
          .filter((typing) => typing.user?.id !== streamClient.userID)
          .map((typing) => typing.user?.name ?? typing.user?.id ?? 'Someone');

        setTypingText(typers.length > 0 ? `${typers[0]} is typing…` : null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [refreshConversations, streamClient]);

  const { channelRows, dmRows } = useMemo(() => {
    const ch: ConversationSummary[] = [];
    const dm: ConversationSummary[] = [];
    for (const row of conversationSummaries) {
      if (isLikelyDm(row.channel)) {
        dm.push(row);
      } else {
        ch.push(row);
      }
    }
    return { channelRows: ch, dmRows: dm };
  }, [conversationSummaries]);

  const visibleRows = useMemo(() => {
    const pool = activeSection === 'channels' ? channelRows : dmRows;
    const q = listSearch.trim().toLowerCase();
    if (!q) {
      return pool;
    }
    return pool.filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        r.info.toLowerCase().includes(q),
    );
  }, [activeSection, channelRows, dmRows, listSearch]);

  const unreadChannels = useMemo(
    () => channelRows.filter((c) => c.unreadCount > 0).length,
    [channelRows],
  );
  const unreadDms = useMemo(
    () => dmRows.filter((c) => c.unreadCount > 0).length,
    [dmRows],
  );

  const mentionCandidates = useMemo((): ChannelMemberResponse[] => {
    if (!streamClient?.userID || !activeChannel || !composerMention) {
      return [];
    }
    const self = streamClient.userID;
    const q = composerMention.query.trim().toLowerCase();
    const members = Object.values(
      activeChannel.state.members ?? {},
    ) as ChannelMemberResponse[];
    return members
      .filter((m) => {
        const uid = m.user?.id;
        if (!uid || uid === self) {
          return false;
        }
        const name = (m.user?.name ?? uid).toLowerCase();
        if (!q) {
          return true;
        }
        return name.includes(q) || uid.toLowerCase().includes(q);
      })
      .slice(0, 10);
  }, [streamClient, activeChannel, composerMention]);

  const threadMentionCandidates = useMemo((): ChannelMemberResponse[] => {
    if (!streamClient?.userID || !activeChannel || !threadComposerMention) {
      return [];
    }
    const self = streamClient.userID;
    const q = threadComposerMention.query.trim().toLowerCase();
    const members = Object.values(
      activeChannel.state.members ?? {},
    ) as ChannelMemberResponse[];
    return members
      .filter((m) => {
        const uid = m.user?.id;
        if (!uid || uid === self) {
          return false;
        }
        const name = (m.user?.name ?? uid).toLowerCase();
        if (!q) {
          return true;
        }
        return name.includes(q) || uid.toLowerCase().includes(q);
      })
      .slice(0, 10);
  }, [streamClient, activeChannel, threadComposerMention]);

  const channelTitleByCid = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of conversationSummaries) {
      map.set(row.id, row.title);
    }
    return map;
  }, [conversationSummaries]);

  const workspaceLabelByStreamId = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of workspaceChatMembers) {
      const label =
        [row.firstName, row.lastName].filter(Boolean).join(' ').trim() ||
        row.email ||
        row.streamUserId;
      map.set(row.streamUserId, label);
    }
    return map;
  }, [workspaceChatMembers]);

  const resolveAuthorName = useCallback(
    (userId: string | undefined, streamName: string | undefined) =>
      labelForStreamUser(workspaceLabelByStreamId, userId, streamName),
    [workspaceLabelByStreamId],
  );

  const conversationTitle = useCallback(
    (row: ConversationSummary) => {
      if (!streamClient?.userID || !isLikelyDm(row.channel)) {
        return row.title;
      }
      const self = streamClient.userID;
      const members = Object.values(
        row.channel.state.members ?? {},
      ) as ChannelMemberResponse[];
      const peer = members.find((m) => m.user?.id && m.user.id !== self);
      const pid = peer?.user?.id;
      if (pid && workspaceLabelByStreamId.has(pid)) {
        return workspaceLabelByStreamId.get(pid) as string;
      }
      return row.title;
    },
    [streamClient?.userID, workspaceLabelByStreamId],
  );

  const rootMessages = useMemo(
    () => channelMessages.filter((m) => !m.parent_id),
    [channelMessages],
  );

  useEffect(() => {
    if (!composerMention || mentionCandidates.length === 0) {
      return;
    }
    setMentionHighlightIndex((i) =>
      Math.min(i, mentionCandidates.length - 1),
    );
  }, [composerMention, mentionCandidates.length]);

  useEffect(() => {
    if (!threadComposerMention || threadMentionCandidates.length === 0) {
      return;
    }
    setThreadMentionHighlightIndex((i) =>
      Math.min(i, threadMentionCandidates.length - 1),
    );
  }, [threadComposerMention, threadMentionCandidates.length]);

  const lastMessageTime = (row: ConversationSummary): Date | null => {
    const msgs = row.channel.state.messages;
    const last = msgs[msgs.length - 1];
    if (!last?.created_at) {
      return null;
    }
    return new Date(last.created_at);
  };

  const pumpComposerTyping = useCallback(() => {
    if (!activeChannel) {
      return;
    }

    void activeChannel.keystroke();

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      void activeChannel.stopTyping();
    }, 1500);
  }, [activeChannel]);

  const handleComposerInput = (event: ChangeEvent<HTMLTextAreaElement>) => {
    const value = event.target.value;
    const sel = event.target.selectionStart ?? value.length;
    setDraft(value);
    pumpComposerTyping();
    const before = value.slice(0, sel);
    const m = before.match(/(^|\s)@([^\s@]*)$/);
    if (m) {
      const atIndex = before.lastIndexOf('@');
      setComposerMention({
        replaceFrom: atIndex,
        replaceTo: sel,
        query: m[2] ?? '',
      });
      setMentionHighlightIndex(0);
    } else {
      setComposerMention(null);
    }
  };

  const insertComposerMention = useCallback(
    (member: ChannelMemberResponse) => {
      if (!composerMention) {
        return;
      }
      const uid = member.user?.id;
      if (!uid) {
        return;
      }
      const rawName = resolveAuthorName(member.user?.id, member.user?.name);
      const label = rawName.trim() !== '' ? rawName : uid;
      const insertion = `@${label} `;
      const caret = composerMention.replaceFrom + insertion.length;
      pendingMentionUserIdsRef.current.add(uid);
      setDraft((prev) => {
        const before = prev.slice(0, composerMention.replaceFrom);
        const after = prev.slice(composerMention.replaceTo);
        return before + insertion + after;
      });
      setComposerMention(null);
      requestAnimationFrame(() => {
        const el = composerTextareaRef.current;
        if (el) {
          el.focus();
          el.setSelectionRange(caret, caret);
        }
      });
    },
    [composerMention, resolveAuthorName],
  );

  const handleThreadComposerInput = (
    event: ChangeEvent<HTMLTextAreaElement>,
  ) => {
    const value = event.target.value;
    const sel = event.target.selectionStart ?? value.length;
    setThreadDraft(value);
    pumpComposerTyping();
    const before = value.slice(0, sel);
    const m = before.match(/(^|\s)@([^\s@]*)$/);
    if (m) {
      const atIndex = before.lastIndexOf('@');
      setThreadComposerMention({
        replaceFrom: atIndex,
        replaceTo: sel,
        query: m[2] ?? '',
      });
      setThreadMentionHighlightIndex(0);
    } else {
      setThreadComposerMention(null);
    }
  };

  const insertThreadMention = useCallback(
    (member: ChannelMemberResponse) => {
      if (!threadComposerMention) {
        return;
      }
      const uid = member.user?.id;
      if (!uid) {
        return;
      }
      const rawName = resolveAuthorName(member.user?.id, member.user?.name);
      const label = rawName.trim() !== '' ? rawName : uid;
      const insertion = `@${label} `;
      const caret = threadComposerMention.replaceFrom + insertion.length;
      pendingThreadMentionUserIdsRef.current.add(uid);
      setThreadDraft((prev) => {
        const before = prev.slice(0, threadComposerMention.replaceFrom);
        const after = prev.slice(threadComposerMention.replaceTo);
        return before + insertion + after;
      });
      setThreadComposerMention(null);
      requestAnimationFrame(() => {
        const el = threadTextareaRef.current;
        if (el) {
          el.focus();
          el.setSelectionRange(caret, caret);
        }
      });
    },
    [resolveAuthorName, threadComposerMention],
  );

  const handleSend = async () => {
    if (!activeChannel) {
      return;
    }

    const trimmed = draft.trim();
    if (trimmed === '' && !pendingFile) {
      return;
    }

    setComposerSending(true);
    try {
      if (pendingFile) {
        const isImage = pendingFile.type.startsWith('image/');
        const upload = isImage
          ? await activeChannel.sendImage(pendingFile)
          : await activeChannel.sendFile(pendingFile);

        const fileUrl = upload.file;

        if (!fileUrl) {
          throw new Error('Upload did not return a file URL');
        }

        const attachments = isImage
          ? [
              {
                type: 'image' as const,
                image_url: fileUrl,
                fallback: pendingFile.name,
              },
            ]
          : [
              {
                type: 'file' as const,
                asset_url: fileUrl,
                title: pendingFile.name,
                mime_type: pendingFile.type,
                file_size: pendingFile.size,
              },
            ];

        const mentionedUsers =
          pendingMentionUserIdsRef.current.size > 0
            ? [...pendingMentionUserIdsRef.current]
            : undefined;

        await activeChannel.sendMessage({
          text: trimmed,
          attachments,
          ...(mentionedUsers ? { mentioned_users: mentionedUsers } : {}),
        });
        setPendingFile(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      } else {
        const mentionedUsers =
          pendingMentionUserIdsRef.current.size > 0
            ? [...pendingMentionUserIdsRef.current]
            : undefined;

        await activeChannel.sendMessage({
          text: trimmed,
          ...(mentionedUsers ? { mentioned_users: mentionedUsers } : {}),
        });
      }
    } catch {
      // Keep draft / file so the user can retry
      return;
    } finally {
      setComposerSending(false);
    }

    pendingMentionUserIdsRef.current.clear();
    setComposerMention(null);
    setDraft('');
    void activeChannel.stopTyping();
  };

  const handleOpenCreateChannel = () => {
    if (!layout?.categories?.length) {
      window.alert(
        'No channel categories yet. Ask a workspace admin to add one in chat settings, or create a category first.',
      );
      return;
    }
    setCreateChannelOpen(true);
  };

  const handleChannelCreated = useCallback(
    async (channelId: string) => {
      if (!streamClient) {
        return;
      }

      const ch = streamClient.channel('messaging', channelId);
      await ch.watch();
      await refreshConversations(streamClient);
      setActiveChannel(ch);
      setActiveSection('channels');
    },
    [refreshConversations, streamClient],
  );

  const handleCreateDm = () => {
    setDmModalOpen(true);
  };

  const handleStartDmFromPicker = useCallback(
    async (peerStreamUserId: string) => {
      if (!streamClient?.userID) {
        throw new Error('Not connected to chat');
      }

      if (peerStreamUserId === streamClient.userID) {
        throw new Error('Cannot message yourself');
      }

      const bearer = crmToken ?? (await getClerkToken());

      if (!bearer) {
        throw new Error('Missing auth token');
      }

      await ensureStreamWorkspaceUsers({
        bearerToken: bearer,
        clerkOrgId: clerkOrgId ?? undefined,
        fallbackUid,
        scopedUserIds: [streamClient.userID, peerStreamUserId],
      });

      const dmChannel = streamClient.channel('messaging', {
        members: [streamClient.userID, peerStreamUserId],
        konnecctKind: 'dm',
      } as Record<string, unknown>);

      await dmChannel.watch();
      await refreshConversations(streamClient);
      setActiveChannel(dmChannel);
      setActiveSection('dms');
    },
    [
      clerkOrgId,
      crmToken,
      fallbackUid,
      getClerkToken,
      refreshConversations,
      streamClient,
    ],
  );

  const handleStartCall = async () => {
    if (!streamVideoClient || !activeChannel) {
      return;
    }

    setJoiningCall(true);
    try {
      const callId = `konnecct-${activeChannel.cid.replace(':', '-')}`;
      const call = streamVideoClient.call('default', callId);

      await call.join({
        create: true,
      });

      setActiveCall(call);
      setIsCallPanelOpen(true);
      setCallMinimized(false);
    } finally {
      setJoiningCall(false);
    }
  };

  const handleEndCall = async () => {
    if (activeCall) {
      await activeCall.leave();
    }

    setActiveCall(undefined);
    setIsCallPanelOpen(false);
    setCallMinimized(false);
  };

  const loadOlderMessages = useCallback(async () => {
    if (!activeChannel || loadingOlderRef.current) {
      return;
    }
    const list = activeChannel.state.messages;
    if (list.length === 0) {
      return;
    }
    const oldest = list[0];
    loadingOlderRef.current = true;
    try {
      await activeChannel.query(
        { messages: { limit: 40, id_lt: oldest.id } },
        'current',
      );
      setChannelMessages([...activeChannel.state.messages]);
    } catch {
      // ignore
    } finally {
      loadingOlderRef.current = false;
    }
  }, [activeChannel]);

  const handleSendThread = async () => {
    if (!activeChannel || !threadRoot?.id) {
      return;
    }
    const trimmed = threadDraft.trim();
    if (trimmed === '') {
      return;
    }
    setThreadSending(true);
    try {
      const mentionedUsers =
        pendingThreadMentionUserIdsRef.current.size > 0
          ? [...pendingThreadMentionUserIdsRef.current]
          : undefined;

      await activeChannel.sendMessage({
        parent_id: threadRoot.id,
        text: trimmed,
        ...(mentionedUsers ? { mentioned_users: mentionedUsers } : {}),
      });
      pendingThreadMentionUserIdsRef.current.clear();
      setThreadComposerMention(null);
      setThreadDraft('');
      const res = await activeChannel.getReplies(threadRoot.id, {
        limit: 80,
      });
      setThreadReplies(res.messages ?? []);
    } catch {
      // keep draft
    } finally {
      setThreadSending(false);
    }
  };

  const handlePickGlobalSearchHit = useCallback(
    async (message: MessageResponse) => {
      if (!streamClient) {
        return;
      }
      const cid = message.cid ?? message.channel?.cid;
      if (!cid || typeof cid !== 'string') {
        return;
      }
      const colon = cid.indexOf(':');
      if (colon < 0) {
        return;
      }
      const channelType = cid.slice(0, colon);
      const channelId = cid.slice(colon + 1);
      const ch = streamClient.channel(channelType, channelId);
      await ch.watch();
      try {
        await ch.state.loadMessageIntoState(message.id);
      } catch {
        // still switch channel; message context may be unavailable
      }
      setGlobalSearchOpen(false);
      setGlobalQuery('');
      setGlobalHits([]);
      setActiveChannel(ch);
      setActiveSection(isLikelyDm(ch) ? 'dms' : 'channels');
      setChannelMessages([...ch.state.messages]);
      await refreshConversations(streamClient);
      requestAnimationFrame(() => {
        document
          .getElementById(`hub-msg-${message.id}`)
          ?.scrollIntoView({ block: 'center' });
      });
    },
    [refreshConversations, streamClient],
  );

  const onMessagesScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (e.currentTarget.scrollTop < 72) {
      void loadOlderMessages();
    }
  };

  const onPanelResizeMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    resizeDragRef.current = {
      startX: e.clientX,
      startWidth: rightPanelWidth,
    };
    const onMove = (ev: MouseEvent) => {
      const r = resizeDragRef.current;
      if (!r) {
        return;
      }
      const delta = r.startX - ev.clientX;
      setRightPanelWidth(
        Math.min(520, Math.max(220, r.startWidth + delta)),
      );
    };
    const onUp = () => {
      resizeDragRef.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  if (status === 'error') {
    return (
      <StyledError>
        {errorMessage ?? 'Failed to initialize Stream.'}
      </StyledError>
    );
  }

  if (status !== 'ready') {
    return <StyledCenterState>Connecting to Stream…</StyledCenterState>;
  }

  if (!streamClient) {
    return <StyledCenterState>Preparing chat client…</StyledCenterState>;
  }

  const activeSummary = conversationSummaries.find(
    (summary) => summary.id === activeChannel?.cid,
  );

  const selfId = streamClient.userID;

  const attachmentVisual = (
    message: MessageResponse,
  ):
    | { kind: 'image'; url: string }
    | { kind: 'file'; url: string; title: string }
    | null => {
    const raw = message.attachments?.[0] as
      | {
          type?: string;
          image_url?: string;
          asset_url?: string;
          thumb_url?: string;
          title?: string;
          mime_type?: string;
        }
      | undefined;

    if (!raw) {
      return null;
    }

    const imageCandidate =
      raw.image_url ?? raw.thumb_url ?? raw.asset_url ?? undefined;

    if (
      typeof imageCandidate === 'string' &&
      imageCandidate.length > 0 &&
      (raw.type === 'image' || raw.mime_type?.startsWith('image/'))
    ) {
      return { kind: 'image', url: imageCandidate };
    }

    if (typeof raw.asset_url === 'string' && raw.asset_url.length > 0) {
      return {
        kind: 'file',
        url: raw.asset_url,
        title: raw.title?.trim() || 'File',
      };
    }

    if (typeof imageCandidate === 'string' && imageCandidate.length > 0) {
      return { kind: 'image', url: imageCandidate };
    }

    return null;
  };

  const showRightPanel =
    Boolean(activeChannel && activeSummary) &&
    ((isNarrowViewport && rightPanelMobileOpen) ||
      (!isNarrowViewport && rightPanelOpen));

  const channelMembers: ChannelMemberResponse[] = activeChannel
    ? (Object.values(
        activeChannel.state.members ?? {},
      ) as ChannelMemberResponse[])
    : [];

  return (
    <StyledShell>
      <StyledHub>
        <StyledRail aria-label="Chat sections">
          <StyledRailButton
            $active={activeSection === 'channels'}
            aria-label="Channels"
            title="Channels"
            type="button"
            onClick={() => setActiveSection('channels')}
          >
            <IconNotes size={themeCssVariables.icon.size.md} />
            {unreadChannels > 0 ? (
              <StyledRailBadge>
                {unreadChannels > 9 ? '9+' : unreadChannels}
              </StyledRailBadge>
            ) : null}
          </StyledRailButton>
          <StyledRailButton
            $active={activeSection === 'dms'}
            aria-label="Direct messages"
            title="Direct messages"
            type="button"
            onClick={() => setActiveSection('dms')}
          >
            <IconMessage size={themeCssVariables.icon.size.md} />
            {unreadDms > 0 ? (
              <StyledRailBadge>
                {unreadDms > 9 ? '9+' : unreadDms}
              </StyledRailBadge>
            ) : null}
          </StyledRailButton>
        </StyledRail>

        <StyledListPanel>
          <StyledListHeader>
            <StyledListTitle>
              {activeSection === 'channels' ? 'Channels' : 'Direct messages'}
            </StyledListTitle>
            <StyledSearchWrap>
              <StyledSearchIcon>
                <IconSearch size={themeCssVariables.icon.size.sm} />
              </StyledSearchIcon>
              <StyledSearchInput
                ref={listSearchInputRef}
                placeholder={
                  activeSection === 'channels'
                    ? 'Search channels…'
                    : 'Search people…'
                }
                value={listSearch}
                onChange={(e) => setListSearch(e.target.value)}
              />
            </StyledSearchWrap>
          </StyledListHeader>
          <StyledListScroll>
            {visibleRows.map((row) => {
              const t = lastMessageTime(row);
              return (
                <StyledListRow
                  key={row.id}
                  $active={row.id === activeChannel?.cid}
                  type="button"
                  onClick={() => setActiveChannel(row.channel)}
                >
                  <StyledAvatar>
                    {initialsFromName(conversationTitle(row))}
                  </StyledAvatar>
                  <StyledRowBody>
                    <StyledRowTop>
                      <StyledRowName>{conversationTitle(row)}</StyledRowName>
                      {t ? (
                        <StyledRowTime>
                          {formatDistanceToNow(t, { addSuffix: false })}
                        </StyledRowTime>
                      ) : null}
                    </StyledRowTop>
                    <StyledRowPreview>
                      <StyledRowInfo>{row.info}</StyledRowInfo>
                      {row.unreadCount > 0 ? (
                        <StyledUnreadDot>
                          {row.unreadCount > 99 ? '99+' : row.unreadCount}
                        </StyledUnreadDot>
                      ) : null}
                    </StyledRowPreview>
                  </StyledRowBody>
                </StyledListRow>
              );
            })}
            <StyledAddRow
              type="button"
              onClick={() =>
                activeSection === 'channels'
                  ? handleOpenCreateChannel()
                  : void handleCreateDm()
              }
            >
              <IconPlus size={themeCssVariables.icon.size.sm} />
              {activeSection === 'channels' ? 'Add channel' : 'New message'}
            </StyledAddRow>
          </StyledListScroll>
        </StyledListPanel>

        <StyledMainStage>
          <StyledMain>
            {activeChannel && activeSummary ? (
              <>
                <StyledMainHeader>
                  <StyledHeaderLeft>
                    <IconNotes size={themeCssVariables.icon.size.md} />
                    <StyledHeaderTitles>
                      <StyledHeaderName>
                        {conversationTitle(activeSummary)}
                      </StyledHeaderName>
                      <StyledHeaderMeta>
                        {memberCount(activeChannel)} members ·{' '}
                        {channelMessages.length} messages
                      </StyledHeaderMeta>
                    </StyledHeaderTitles>
                  </StyledHeaderLeft>
                  <StyledHeaderActions>
                    <LightIconButton
                      Icon={IconUsers}
                      accent="tertiary"
                      active={
                        showRightPanel && rightPanelTab === 'members'
                      }
                      aria-label="Members"
                      title="Members"
                      onClick={() => {
                        setRightPanelTab('members');
                        if (isNarrowViewport) {
                          setRightPanelMobileOpen((open) => !open);
                        } else if (rightPanelOpen && rightPanelTab === 'members') {
                          setRightPanelOpen(false);
                        } else {
                          setRightPanelOpen(true);
                        }
                      }}
                    />
                    <LightIconButton
                      Icon={IconSearch}
                      accent="tertiary"
                      active={
                        showRightPanel && rightPanelTab === 'search'
                      }
                      aria-label="Search in conversation"
                      title="Search in conversation"
                      onClick={() => {
                        setRightPanelTab('search');
                        if (isNarrowViewport) {
                          setRightPanelMobileOpen(true);
                        } else {
                          setRightPanelOpen(true);
                        }
                      }}
                    />
                    <LightIconButton
                      Icon={IconWorld}
                      accent="tertiary"
                      active={globalSearchOpen}
                      aria-label="Search all messages"
                      title="Search all messages (Ctrl+Shift+K)"
                      onClick={() => setGlobalSearchOpen(true)}
                    />
                    {joiningCall ? (
                      <StyledJoiningBanner>Joining call…</StyledJoiningBanner>
                    ) : null}
                    <LightIconButton
                      Icon={IconPhone}
                      accent="tertiary"
                      aria-label="Start call"
                      disabled={joiningCall}
                      onClick={() => void handleStartCall()}
                    />
                    <Button
                      title="New DM"
                      variant="secondary"
                      size="small"
                      onClick={() => void handleCreateDm()}
                    />
                    {isCallPanelOpen && !callMinimized ? (
                      <Button
                        title="Minimize call"
                        variant="secondary"
                        size="small"
                        onClick={() => setCallMinimized(true)}
                      />
                    ) : null}
                    {isCallPanelOpen ? (
                      <Button
                        title="End call"
                        variant="secondary"
                        accent="danger"
                        size="small"
                        onClick={() => void handleEndCall()}
                      />
                    ) : null}
                  </StyledHeaderActions>
                </StyledMainHeader>

                <StyledMessages
                  ref={messagesScrollRef}
                  onScroll={onMessagesScroll}
                >
                  {rootMessages.map((message) => {
                    const own = message.user?.id === selfId;
                    const author = resolveAuthorName(
                      message.user?.id,
                      message.user?.name,
                    );
                    const body =
                      typeof message.text === 'string' &&
                      message.text.trim() !== ''
                        ? message.text
                        : '';
                    const visual = attachmentVisual(message);
                    const time = new Date(
                      message.created_at ?? Date.now(),
                    ).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    });
                    const replyCount = message.reply_count ?? 0;
                    const reactionCounts = message.reaction_counts ?? {};

                    return (
                      <StyledMessageWrap key={message.id} $own={own}>
                        <StyledMessageRow
                          id={`hub-msg-${message.id}`}
                          $own={own}
                        >
                          <StyledMsgAvatar>
                            {initialsFromName(author)}
                          </StyledMsgAvatar>
                          <StyledMsgCol $own={own}>
                            <StyledMsgMeta $own={own}>
                              <StyledMsgAuthor>
                                {own ? 'You' : author}
                              </StyledMsgAuthor>
                              <StyledMsgTime>{time}</StyledMsgTime>
                            </StyledMsgMeta>
                            <StyledBubble $own={own}>
                              {visual?.kind === 'image' ? (
                                <StyledAttachmentImg
                                  alt=""
                                  src={visual.url}
                                />
                              ) : null}
                              {visual?.kind === 'file' ? (
                                <StyledFileLink
                                  href={visual.url}
                                  rel="noopener noreferrer"
                                  target="_blank"
                                >
                                  <IconFileText
                                    size={themeCssVariables.icon.size.sm}
                                  />
                                  {visual.title}
                                </StyledFileLink>
                              ) : null}
                              {body ||
                                (visual
                                  ? ''
                                  : message.attachments?.length
                                    ? '[Attachment]'
                                    : '')}
                            </StyledBubble>
                            {own && message.status ? (
                              <StyledMutedHelp>
                                {message.status === 'received' ||
                                message.status === 'read'
                                  ? 'Delivered'
                                  : 'Sent'}
                              </StyledMutedHelp>
                            ) : null}
                          </StyledMsgCol>
                        </StyledMessageRow>
                        <StyledReactionBar className="hub-react-bar">
                          {HUB_QUICK_REACTION_TYPES.map((emoji) => {
                            const count = reactionCounts[emoji] ?? 0;
                            return (
                              <StyledReactionChip
                                key={emoji}
                                type="button"
                                title={emoji}
                                onClick={() => {
                                  if (!activeChannel) {
                                    return;
                                  }
                                  void activeChannel
                                    .sendReaction(message.id, {
                                      type: emoji as string,
                                    })
                                    .catch(() => {});
                                }}
                              >
                                {emoji}
                                {count > 0 ? ` ${count}` : ''}
                              </StyledReactionChip>
                            );
                          })}
                          {Object.entries(reactionCounts)
                            .filter(([k]) => !QUICK_REACTION_SET.has(k))
                            .map(([k, n]) => (
                              <StyledReactionChip key={k} type="button">
                                {k} {String(n)}
                              </StyledReactionChip>
                            ))}
                        </StyledReactionBar>
                        <StyledThreadHint
                          type="button"
                          onClick={() => setThreadRoot(message)}
                        >
                          {replyCount > 0
                            ? `${replyCount} ${replyCount === 1 ? 'reply' : 'replies'} — Thread`
                            : 'Reply in thread'}
                        </StyledThreadHint>
                      </StyledMessageWrap>
                    );
                  })}
                </StyledMessages>
                {typingText ? (
                  <StyledTyping>{typingText}</StyledTyping>
                ) : null}
                {pendingFile ? (
                  <StyledFileChip>
                    <IconPaperclip
                      size={themeCssVariables.icon.size.sm}
                      color={themeCssVariables.color.blue}
                    />
                    <StyledFileChipName>{pendingFile.name}</StyledFileChipName>
                    <LightIconButton
                      Icon={IconX}
                      accent="tertiary"
                      aria-label="Remove attachment"
                      onClick={() => {
                        setPendingFile(null);
                        if (fileInputRef.current) {
                          fileInputRef.current.value = '';
                        }
                      }}
                    />
                  </StyledFileChip>
                ) : null}
                {threadRoot ? (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <StyledThreadDrawer>
                      <StyledThreadHeader>
                        <StyledMutedHelp>Thread</StyledMutedHelp>
                        <LightIconButton
                          Icon={IconX}
                          accent="tertiary"
                          aria-label="Close thread"
                          onClick={() => setThreadRoot(null)}
                        />
                      </StyledThreadHeader>
                      <StyledThreadScroll>
                        {threadReplies.map((tm) => {
                          const ta = resolveAuthorName(
                            tm.user?.id,
                            tm.user?.name,
                          );
                          const tb =
                            typeof tm.text === 'string' ? tm.text : '';
                          const tmOwn = tm.user?.id === selfId;

                          return (
                            <StyledMessageRow key={tm.id} $own={tmOwn}>
                              <StyledMsgAvatar>
                                {initialsFromName(ta)}
                              </StyledMsgAvatar>
                              <StyledMsgCol $own={tmOwn}>
                                <StyledMsgMeta $own={tmOwn}>
                                  <StyledMsgAuthor>
                                    {tmOwn ? 'You' : ta}
                                  </StyledMsgAuthor>
                                </StyledMsgMeta>
                                <StyledBubble $own={tmOwn}>{tb}</StyledBubble>
                              </StyledMsgCol>
                            </StyledMessageRow>
                          );
                        })}
                      </StyledThreadScroll>
                      <StyledThreadComposerBar>
                        <StyledComposerFieldWrap>
                          {threadComposerMention &&
                          threadMentionCandidates.length > 0 ? (
                            <StyledMentionPopover role="listbox">
                              {threadMentionCandidates.map((mem, idx) => {
                                const mname = resolveAuthorName(
                                  mem.user?.id,
                                  mem.user?.name,
                                );
                                return (
                                  <StyledMentionItem
                                    key={mem.user?.id ?? String(idx)}
                                    $active={idx === threadMentionHighlightIndex}
                                    role="option"
                                    onMouseDown={(ev) => {
                                      ev.preventDefault();
                                      insertThreadMention(mem);
                                    }}
                                  >
                                    {mname}
                                  </StyledMentionItem>
                                );
                              })}
                            </StyledMentionPopover>
                          ) : null}
                          <StyledComposerInput
                            ref={threadTextareaRef}
                            placeholder="Reply in thread…"
                            rows={2}
                            value={threadDraft}
                            onChange={handleThreadComposerInput}
                            onKeyDown={(
                              e: KeyboardEvent<HTMLTextAreaElement>,
                            ) => {
                              if (
                                threadComposerMention &&
                                threadMentionCandidates.length > 0
                              ) {
                                if (e.key === 'ArrowDown') {
                                  e.preventDefault();
                                  setThreadMentionHighlightIndex((i) =>
                                    Math.min(
                                      threadMentionCandidates.length - 1,
                                      i + 1,
                                    ),
                                  );
                                  return;
                                }
                                if (e.key === 'ArrowUp') {
                                  e.preventDefault();
                                  setThreadMentionHighlightIndex((i) =>
                                    Math.max(0, i - 1),
                                  );
                                  return;
                                }
                                if (e.key === 'Enter' && !e.shiftKey) {
                                  e.preventDefault();
                                  const pick =
                                    threadMentionCandidates[
                                      threadMentionHighlightIndex
                                    ];
                                  if (pick) {
                                    insertThreadMention(pick);
                                  }
                                  return;
                                }
                                if (e.key === 'Escape') {
                                  e.preventDefault();
                                  setThreadComposerMention(null);
                                  return;
                                }
                              }
                              if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                void handleSendThread();
                              }
                            }}
                          />
                        </StyledComposerFieldWrap>
                        <LightIconButton
                          Icon={IconSend}
                          accent="secondary"
                          aria-label="Send thread reply"
                          disabled={!threadDraft.trim() || threadSending}
                          onClick={() => void handleSendThread()}
                        />
                      </StyledThreadComposerBar>
                    </StyledThreadDrawer>
                  </motion.div>
                ) : null}
                <StyledComposer>
                  <input
                    ref={fileInputRef}
                    aria-label="Choose file to attach"
                    style={{ display: 'none' }}
                    type="file"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) {
                        setPendingFile(f);
                      }
                    }}
                  />
                  <StyledComposerInner>
                    <LightIconButton
                      Icon={IconPaperclip}
                      accent="tertiary"
                      aria-label="Attach file"
                      title="Attach file"
                      onClick={() => fileInputRef.current?.click()}
                    />
                    <StyledComposerFieldWrap>
                      {composerMention && mentionCandidates.length > 0 ? (
                        <StyledMentionPopover role="listbox">
                          {mentionCandidates.map((mem, idx) => {
                            const mname = resolveAuthorName(
                              mem.user?.id,
                              mem.user?.name,
                            );
                            return (
                              <StyledMentionItem
                                key={mem.user?.id ?? String(idx)}
                                $active={idx === mentionHighlightIndex}
                                role="option"
                                onMouseDown={(ev) => {
                                  ev.preventDefault();
                                  insertComposerMention(mem);
                                }}
                              >
                                {mname}
                              </StyledMentionItem>
                            );
                          })}
                        </StyledMentionPopover>
                      ) : null}
                      <StyledComposerInput
                        ref={composerTextareaRef}
                        placeholder={`Message ${conversationTitle(activeSummary)}`}
                        rows={1}
                        value={draft}
                        onChange={handleComposerInput}
                        onKeyDown={(e: KeyboardEvent<HTMLTextAreaElement>) => {
                          if (
                            composerMention &&
                            mentionCandidates.length > 0
                          ) {
                            if (e.key === 'ArrowDown') {
                              e.preventDefault();
                              setMentionHighlightIndex((i) =>
                                Math.min(
                                  mentionCandidates.length - 1,
                                  i + 1,
                                ),
                              );
                              return;
                            }
                            if (e.key === 'ArrowUp') {
                              e.preventDefault();
                              setMentionHighlightIndex((i) =>
                                Math.max(0, i - 1),
                              );
                              return;
                            }
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              const pick =
                                mentionCandidates[mentionHighlightIndex];
                              if (pick) {
                                insertComposerMention(pick);
                              }
                              return;
                            }
                            if (e.key === 'Escape') {
                              e.preventDefault();
                              setComposerMention(null);
                              return;
                            }
                          }
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            void handleSend();
                          }
                        }}
                        onPaste={(e) => {
                          const f = e.clipboardData.files[0];
                          if (f) {
                            e.preventDefault();
                            setPendingFile(f);
                          }
                        }}
                      />
                    </StyledComposerFieldWrap>
                    <LightIconButton
                      Icon={IconSend}
                      accent="secondary"
                      aria-label="Send"
                      disabled={
                        (!draft.trim() && !pendingFile) || composerSending
                      }
                      onClick={() => void handleSend()}
                    />
                  </StyledComposerInner>
                </StyledComposer>
                {isCallPanelOpen &&
                activeCall &&
                streamVideoClient &&
                !callMinimized ? (
                  <StyledCallWrapper>
                    <StreamVideo client={streamVideoClient}>
                      <StreamCall call={activeCall}>
                        <SpeakerLayout />
                        <CallControls />
                      </StreamCall>
                    </StreamVideo>
                  </StyledCallWrapper>
                ) : null}
                {isCallPanelOpen && activeCall && callMinimized ? (
                  <StyledMiniCallBar>
                    <StyledMutedHelp>Call in progress</StyledMutedHelp>
                    <Button
                      title="Return to call"
                      variant="secondary"
                      size="small"
                      onClick={() => setCallMinimized(false)}
                    />
                    <Button
                      title="End"
                      variant="secondary"
                      accent="danger"
                      size="small"
                      onClick={() => void handleEndCall()}
                    />
                  </StyledMiniCallBar>
                ) : null}
              </>
            ) : (
              <StyledEmpty>
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25 }}
                >
                  <StyledEmptyIcon>
                    <IconMessage
                      size={themeCssVariables.icon.size.xl}
                      color={themeCssVariables.color.blue}
                    />
                  </StyledEmptyIcon>
                  <StyledEmptyTitle>Welcome to Konnecct Chat</StyledEmptyTitle>
                  <StyledEmptyText>
                    Pick a channel or direct message on the left, or start
                    something new. Voice and video use Stream on this screen.
                  </StyledEmptyText>
                  <StyledEmptyActions>
                    <Button
                      title="Browse channels"
                      variant="primary"
                      size="small"
                      onClick={() => setActiveSection('channels')}
                    />
                    <Button
                      title="New DM"
                      variant="secondary"
                      size="small"
                      onClick={() => void handleCreateDm()}
                    />
                  </StyledEmptyActions>
                </motion.div>
              </StyledEmpty>
            )}
          </StyledMain>

          {showRightPanel && activeChannel && activeSummary ? (
            <>
              {isNarrowViewport ? (
                <StyledRightPanelBackdrop
                  aria-label="Close side panel"
                  type="button"
                  onClick={() => setRightPanelMobileOpen(false)}
                />
              ) : null}
              {!isNarrowViewport ? (
                <StyledResizeHandle
                  aria-hidden
                  onMouseDown={onPanelResizeMouseDown}
                />
              ) : null}
              <StyledRightPanel
                $mobileOpen={!isNarrowViewport || rightPanelMobileOpen}
                $width={rightPanelWidth}
              >
                <StyledPanelTabRow>
                  <StyledPanelTab
                    $active={rightPanelTab === 'members'}
                    type="button"
                    onClick={() => setRightPanelTab('members')}
                  >
                    Members
                  </StyledPanelTab>
                  <StyledPanelTab
                    $active={rightPanelTab === 'search'}
                    type="button"
                    onClick={() => setRightPanelTab('search')}
                  >
                    Search
                  </StyledPanelTab>
                </StyledPanelTabRow>
                <StyledPanelBody>
                  {rightPanelTab === 'members' ? (
                    <StyledPanelScroll>
                      {channelMembers.length === 0 ? (
                        <StyledMutedHelp>
                          No members loaded yet.
                        </StyledMutedHelp>
                      ) : (
                        channelMembers.map((m) => {
                          const u = m.user;
                          const label = resolveAuthorName(u?.id, u?.name);

                          return (
                            <StyledMemberRow
                              key={u?.id ?? `member-${label}`}
                            >
                              <StyledMemberAvatar>
                                {initialsFromName(label)}
                              </StyledMemberAvatar>
                              <StyledMemberName>{label}</StyledMemberName>
                            </StyledMemberRow>
                          );
                        })
                      )}
                    </StyledPanelScroll>
                  ) : (
                    <>
                      <StyledSearchInChatInput
                        placeholder="Search messages…"
                        value={inChatSearch}
                        onChange={(e) => setInChatSearch(e.target.value)}
                      />
                      <StyledPanelScroll>
                        {searchRemoteLoading ? (
                          <StyledMutedHelp>Searching…</StyledMutedHelp>
                        ) : inChatSearch.trim().length < 2 ? (
                          <StyledMutedHelp>
                            Type at least 2 characters to search this
                            conversation on the server.
                          </StyledMutedHelp>
                        ) : searchRemoteHits.length === 0 ? (
                          <StyledMutedHelp>No results.</StyledMutedHelp>
                        ) : (
                          searchRemoteHits.map((hit) => {
                            const m = hit.message;
                            const author = resolveAuthorName(
                              m.user?.id,
                              m.user?.name,
                            );
                            const preview =
                              typeof m.text === 'string' ? m.text : '';

                            return (
                              <StyledSearchHit
                                key={m.id}
                                type="button"
                                onClick={() => {
                                  void (async () => {
                                    if (!activeChannel) {
                                      return;
                                    }
                                    await activeChannel.state.loadMessageIntoState(
                                      m.id,
                                    );
                                    setChannelMessages([
                                      ...activeChannel.state.messages,
                                    ]);
                                    requestAnimationFrame(() => {
                                      document
                                        .getElementById(`hub-msg-${m.id}`)
                                        ?.scrollIntoView({
                                          behavior: 'smooth',
                                          block: 'center',
                                        });
                                    });
                                    if (isNarrowViewport) {
                                      setRightPanelMobileOpen(false);
                                    }
                                  })();
                                }}
                              >
                                <StyledSearchHitMeta>
                                  {author} ·{' '}
                                  {new Date(
                                    m.created_at ?? Date.now(),
                                  ).toLocaleString()}
                                </StyledSearchHitMeta>
                                {preview.slice(0, 160)}
                                {preview.length > 160 ? '…' : ''}
                              </StyledSearchHit>
                            );
                          })
                        )}
                      </StyledPanelScroll>
                    </>
                  )}
                </StyledPanelBody>
              </StyledRightPanel>
            </>
          ) : null}
        </StyledMainStage>
      </StyledHub>
      <CreateChannelModal
        isOpen={createChannelOpen}
        layout={layout}
        token={crmToken}
        onClose={() => setCreateChannelOpen(false)}
        onCreated={(id) => void handleChannelCreated(id)}
        onLayoutRefresh={() => void reloadChatLayout()}
      />
      <StreamDmModal
        isOpen={dmModalOpen}
        token={crmToken}
        currentStreamUserId={streamClient.userID}
        onClose={() => setDmModalOpen(false)}
        onStartDm={(id) => handleStartDmFromPicker(id)}
      />
      {globalSearchOpen ? (
        <StyledGlobalSearchBackdrop
          aria-hidden={false}
          role="presentation"
          onClick={() => setGlobalSearchOpen(false)}
        >
          <StyledGlobalSearchModal
            aria-label="Search all messages"
            aria-modal="true"
            role="dialog"
            onClick={(e) => e.stopPropagation()}
          >
            <StyledGlobalSearchHeader>
              <StyledGlobalSearchInput
                ref={globalSearchInputRef}
                placeholder="Search across all conversations…"
                type="search"
                value={globalQuery}
                onChange={(e) => setGlobalQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setGlobalSearchOpen(false);
                  }
                }}
              />
              <StyledMutedHelp>
                Ctrl+Shift+K · min. 2 characters
              </StyledMutedHelp>
            </StyledGlobalSearchHeader>
            <StyledGlobalSearchScroll>
              {globalSearchLoading ? (
                <StyledMutedHelp>Searching…</StyledMutedHelp>
              ) : globalQuery.trim().length < 2 ? (
                <StyledMutedHelp>
                  Type at least 2 characters to search all your channels and
                  DMs.
                </StyledMutedHelp>
              ) : globalHits.length === 0 ? (
                <StyledMutedHelp>No results.</StyledMutedHelp>
              ) : (
                globalHits.map((hit) => {
                  const m = hit.message;
                  const author = resolveAuthorName(
                    m.user?.id,
                    m.user?.name,
                  );
                  const preview =
                    typeof m.text === 'string' ? m.text : '';
                  const cid = m.cid ?? m.channel?.cid ?? '';
                  const channelFromSearch = m.channel as
                    | { name?: string }
                    | undefined;
                  const channelName =
                    (typeof cid === 'string' && cid.length > 0
                      ? channelTitleByCid.get(cid)
                      : undefined) ??
                    (typeof channelFromSearch?.name === 'string'
                      ? channelFromSearch.name
                      : undefined) ??
                    (typeof cid === 'string' ? cid : 'Conversation');

                  return (
                    <StyledGlobalSearchHit
                      key={`${cid}-${m.id}`}
                      type="button"
                      onClick={() => void handlePickGlobalSearchHit(m)}
                    >
                      <div>
                        {preview.slice(0, 200)}
                        {preview.length > 200 ? '…' : ''}
                      </div>
                      <StyledGlobalSearchHitMeta>
                        {channelName} · {author}
                      </StyledGlobalSearchHitMeta>
                    </StyledGlobalSearchHit>
                  );
                })
              )}
            </StyledGlobalSearchScroll>
          </StyledGlobalSearchModal>
        </StyledGlobalSearchBackdrop>
      ) : null}
    </StyledShell>
  );
};
