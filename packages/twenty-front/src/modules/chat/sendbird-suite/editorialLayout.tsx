import { styled } from '@linaria/react';

import { editorialChatTheme as ed } from '@/chat/theme/editorialChatTheme';

export const Shell = styled.div`
  background: ${ed.surface};
  color: ${ed.onSurface};
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  font-family: ${ed.fontStack};
  height: 100%;
  min-height: 0;
  min-width: 0;
  overflow: hidden;
`;

export const WorkspaceRail = styled.aside`
  background: ${ed.surfaceContainerLow};
  border-right: 1px solid ${ed.outlineVariantGhost};
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  min-height: 0;
  width: 248px;
`;

export const RailHeader = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 14px 14px 10px;
`;

export const RailBrandTitle = styled.h1`
  color: ${ed.onSurface};
  font-size: 0.95rem;
  font-weight: 600;
  letter-spacing: -0.02em;
  margin: 0;
`;

export const RailBrandMeta = styled.p`
  color: ${ed.onSurfaceVariant};
  font-size: 0.75rem;
  margin: 0;
  text-transform: uppercase;
  letter-spacing: 0.05em;
`;

export const RailPrimaryCta = styled.button`
  align-items: center;
  background: ${ed.primary};
  border: none;
  border-radius: ${ed.radiusMd};
  color: ${ed.onPrimary};
  cursor: pointer;
  display: flex;
  font-family: ${ed.fontStack};
  font-size: 0.875rem;
  font-weight: 500;
  gap: 8px;
  justify-content: center;
  margin: 0 14px 10px;
  padding: 8px 12px;
  transition: opacity 0.15s ease;

  &:hover {
    opacity: 0.92;
  }
`;

export const RailScroll = styled.div`
  flex: 1 1 auto;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
  padding: 0 6px 8px;
`;

export const RailSectionLabel = styled.div`
  color: ${ed.onSurfaceVariant};
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  padding: 10px 10px 5px;
  text-transform: uppercase;
`;

export const RailNavRow = styled.button<{ $active?: boolean }>`
  align-items: center;
  background: ${({ $active }) =>
    $active ? ed.surfaceContainerHighest : 'transparent'};
  border: none;
  border-radius: ${ed.radiusMd};
  color: ${({ $active }) => ($active ? ed.onSurface : ed.onSurfaceVariant)};
  cursor: pointer;
  display: flex;
  font-family: ${ed.fontStack};
  font-size: 0.875rem;
  gap: 10px;
  margin-bottom: 2px;
  padding: 8px 10px;
  text-align: left;
  width: 100%;

  &:hover {
    background: ${ed.surfaceContainerHigh};
    color: ${ed.onSurface};
  }
`;

export const RailChannelRow = styled.button<{ $active?: boolean }>`
  align-items: center;
  background: ${({ $active }) =>
    $active ? 'rgba(194, 193, 255, 0.08)' : 'transparent'};
  border: none;
  border-left: ${({ $active }) =>
    $active ? `2px solid ${ed.primary}` : '2px solid transparent'};
  color: ${({ $active }) => ($active ? ed.primary : ed.onSurfaceVariant)};
  cursor: pointer;
  display: flex;
  font-family: ${ed.fontStack};
  font-size: 0.875rem;
  gap: 8px;
  margin-bottom: 2px;
  padding: 7px 10px;
  text-align: left;
  width: 100%;

  &:hover {
    color: ${ed.onSurface};
  }
`;

export const RailFooter = styled.div`
  border-top: 1px solid ${ed.outlineVariantGhost};
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  gap: 4px;
  padding: 12px 8px;
`;

export const RailUserRow = styled.div`
  align-items: center;
  display: flex;
  gap: 10px;
  padding: 8px 12px;
`;

export const BodyRow = styled.div`
  display: flex;
  flex: 1 1 auto;
  flex-direction: row;
  min-height: 0;
  min-width: 0;
`;

export const MainColumn = styled.main`
  background: ${ed.surface};
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-height: 0;
  min-width: 0;
  position: relative;
`;

export const TopBar = styled.header`
  align-items: center;
  background: ${ed.surface};
  border-bottom: 1px solid ${ed.outlineVariantGhost};
  display: flex;
  flex-shrink: 0;
  gap: 16px;
  justify-content: space-between;
  min-height: 44px;
  padding: 0 14px;
`;

export const TopBarLeft = styled.div`
  align-items: center;
  display: flex;
  flex: 1 1 auto;
  gap: 12px;
  min-width: 0;
`;

export const TopBarTitle = styled.span`
  color: ${ed.onSurface};
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  overflow: hidden;
  text-overflow: ellipsis;
  text-transform: uppercase;
  white-space: nowrap;
`;

export const TopBarMeta = styled.span`
  color: ${ed.onSurfaceVariant};
  font-size: 0.72rem;
`;

export const TopBarActions = styled.div`
  align-items: center;
  display: flex;
  flex-shrink: 0;
  gap: 8px;
`;

export const IconButtonGhost = styled.button`
  align-items: center;
  background: ${ed.surfaceContainerHigh};
  border: 1px solid ${ed.outlineVariantGhost};
  border-radius: ${ed.radiusMd};
  color: ${ed.primary};
  cursor: pointer;
  display: inline-flex;
  font-family: ${ed.fontStack};
  font-size: 0.8125rem;
  font-weight: 600;
  gap: 6px;
  padding: 8px 12px;

  &:disabled {
    cursor: not-allowed;
    opacity: 0.45;
  }

  &:not(:disabled):hover {
    background: ${ed.surfaceContainerHighest};
  }
`;

export const IconButtonPrimary = styled.button`
  align-items: center;
  background: ${ed.primary};
  border: none;
  border-radius: ${ed.radiusMd};
  color: ${ed.onPrimary};
  cursor: pointer;
  display: inline-flex;
  font-family: ${ed.fontStack};
  font-size: 0.8125rem;
  font-weight: 600;
  gap: 6px;
  padding: 8px 12px;

  &:disabled {
    cursor: not-allowed;
    opacity: 0.45;
  }

  &:not(:disabled):hover {
    opacity: 0.92;
  }
`;

export const SearchField = styled.input`
  background: ${ed.surfaceContainerLow};
  border: 1px solid ${ed.outlineVariantGhost};
  border-radius: ${ed.radiusMd};
  color: ${ed.onSurface};
  font-family: ${ed.fontStack};
  font-size: 0.75rem;
  max-width: 220px;
  padding: 6px 10px;
  width: 100%;

  &::placeholder {
    color: ${ed.onSurfaceVariant};
    opacity: 0.7;
  }

  &:focus {
    border-color: rgba(194, 193, 255, 0.45);
    outline: none;
  }
`;

export const CenterBlock = styled.div`
  align-items: center;
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  gap: 12px;
  justify-content: center;
  padding: 32px;
  text-align: center;
`;

export const CenterTitle = styled.span`
  color: ${ed.onSurface};
  font-size: 0.9375rem;
  font-weight: 600;
`;

export const CenterError = styled(CenterBlock)`
  color: ${ed.error};
`;

export const MessageScroll = styled.div`
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  padding: 12px 14px;
  scroll-behavior: smooth;
`;

export const DatePill = styled.div`
  display: flex;
  justify-content: center;
  margin: 16px 0 24px;
`;

export const DatePillInner = styled.span`
  background: ${ed.surfaceContainerHigh};
  border-radius: ${ed.radiusFull};
  color: ${ed.onSurfaceVariant};
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  padding: 6px 14px;
  text-transform: uppercase;
`;

export const MsgRow = styled.div<{ $own?: boolean }>`
  display: flex;
  flex-direction: ${({ $own }) => ($own ? 'row-reverse' : 'row')};
  gap: 12px;
  margin-bottom: 20px;
  max-width: min(720px, 92%);
  ${({ $own }) => ($own ? 'margin-left: auto;' : '')}
`;

export const MsgStack = styled.div`
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
`;

export const MsgMeta = styled.div<{ $own?: boolean }>`
  align-items: baseline;
  display: flex;
  flex-direction: ${({ $own }) => ($own ? 'row-reverse' : 'row')};
  gap: 8px;
`;

export const MsgAuthor = styled.span`
  color: ${ed.onSurface};
  font-size: 0.875rem;
  font-weight: 600;
`;

export const MsgTime = styled.span`
  color: ${ed.onSurfaceVariant};
  font-size: 0.65rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
`;

export const MsgText = styled.div<{ $own?: boolean }>`
  background: ${({ $own }) =>
    $own ? 'rgba(51, 45, 188, 0.22)' : ed.surfaceContainerHighest};
  border: 1px solid
    ${({ $own }) => ($own ? 'rgba(194, 193, 255, 0.22)' : ed.outlineVariantGhost)};
  border-radius: ${ed.radiusLg};
  color: ${({ $own }) => ($own ? ed.onPrimaryContainer : ed.onSurface)};
  font-size: 0.875rem;
  line-height: 1.5;
  padding: 12px 14px;
  ${({ $own }) => ($own ? 'border-top-right-radius: 4px;' : 'border-top-left-radius: 4px;')}
`;

export const FileCard = styled.a`
  align-items: center;
  background: ${ed.surfaceContainerHighest};
  border: 1px solid ${ed.outlineVariantGhost};
  border-radius: ${ed.radiusLg};
  color: inherit;
  display: flex;
  gap: 14px;
  margin-top: 8px;
  max-width: 420px;
  padding: 14px 16px;
  text-decoration: none;
  transition: background 0.15s ease;

  &:hover {
    background: ${ed.surfaceBright};
  }
`;

export const ReactionRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
`;

export const ReactionChip = styled.button`
  align-items: center;
  background: ${ed.surfaceContainerHighest};
  border: 1px solid ${ed.outlineVariantGhost};
  border-radius: ${ed.radiusSm};
  color: ${ed.onSurface};
  cursor: pointer;
  display: inline-flex;
  font-size: 0.75rem;
  font-weight: 700;
  gap: 4px;
  padding: 4px 8px;

  &:hover {
    border-color: rgba(194, 193, 255, 0.35);
  }
`;

export const ThreadHint = styled.button`
  background: transparent;
  border: none;
  color: ${ed.primary};
  cursor: pointer;
  font-family: ${ed.fontStack};
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  margin-top: 8px;
  padding: 0;
  text-transform: uppercase;

  &:hover {
    text-decoration: underline;
  }
`;

export const TypingLine = styled.div`
  align-items: center;
  color: ${ed.onSurfaceVariant};
  display: flex;
  font-size: 0.65rem;
  font-weight: 600;
  gap: 8px;
  letter-spacing: 0.08em;
  margin: 8px 0 16px;
  text-transform: uppercase;
`;

export const ComposerWrap = styled.footer`
  border-top: 1px solid ${ed.outlineVariantGhost};
  flex-shrink: 0;
  padding: 10px 14px 12px;
`;

export const ComposerBox = styled.div`
  background: ${ed.surfaceContainerHighest};
  border: 1px solid ${ed.outlineVariantGhost};
  border-radius: ${ed.radiusLg};
  box-shadow: ${ed.shadowElevated};
  max-width: 100%;
  margin: 0 auto;
  transition: border-color 0.15s ease;

  &:focus-within {
    border-color: rgba(194, 193, 255, 0.45);
  }
`;

export const ComposerToolbar = styled.div`
  border-bottom: 1px solid ${ed.outlineVariantGhost};
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  padding: 6px 8px;
`;

export const ToolbarBtn = styled.button`
  align-items: center;
  background: transparent;
  border: none;
  border-radius: ${ed.radiusSm};
  color: ${ed.onSurfaceVariant};
  cursor: pointer;
  display: inline-flex;
  padding: 4px;

  &:hover {
    background: ${ed.surfaceBright};
    color: ${ed.primary};
  }
`;

export const ComposerTextarea = styled.textarea`
  background: transparent;
  border: none;
  color: ${ed.onSurface};
  font-family: ${ed.fontStack};
  font-size: 0.875rem;
  line-height: 1.45;
  max-height: 180px;
  min-height: 48px;
  padding: 10px 12px;
  resize: none;
  width: 100%;

  &::placeholder {
    color: ${ed.onSurfaceVariant};
    opacity: 0.65;
  }

  &:focus {
    outline: none;
  }
`;

export const ComposerBottom = styled.div`
  align-items: center;
  display: flex;
  justify-content: space-between;
  padding: 6px 8px 8px;
`;

export const ComposerIconGroup = styled.div`
  align-items: center;
  display: flex;
  gap: 4px;
`;

export const SendFab = styled.button`
  align-items: center;
  background: ${ed.primary};
  border: none;
  border-radius: ${ed.radiusSm};
  color: ${ed.onPrimary};
  cursor: pointer;
  display: inline-flex;
  padding: 8px 10px;

  &:disabled {
    cursor: not-allowed;
    opacity: 0.45;
  }

  &:not(:disabled):hover {
    opacity: 0.92;
  }
`;

export const DetailsColumn = styled.aside`
  background: ${ed.surfaceContainerLow};
  border-left: 1px solid ${ed.outlineVariantGhost};
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  min-height: 0;
  overflow: hidden;
  width: 290px;

  @media (max-width: 1200px) {
    display: none;
  }
`;

export const DetailsHeader = styled.div`
  align-items: center;
  display: flex;
  justify-content: space-between;
  padding: 20px 20px 12px;
`;

export const DetailsTitle = styled.h3`
  color: ${ed.onSurface};
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  margin: 0;
  text-transform: uppercase;
`;

export const DetailsScroll = styled.div`
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  padding: 0 20px 20px;
`;

export const BentoGrid = styled.div`
  display: grid;
  gap: 8px;
  grid-template-columns: 1fr 1fr;
  margin-bottom: 20px;
`;

export const BentoCell = styled.div`
  background: ${ed.surfaceContainerHighest};
  border: 1px solid ${ed.outlineVariantGhost};
  border-radius: ${ed.radiusMd};
  padding: 12px;
`;

export const BentoLabel = styled.div`
  color: ${ed.onSurfaceVariant};
  font-size: 0.6rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  margin-bottom: 4px;
  text-transform: uppercase;
`;

export const BentoValue = styled.div`
  color: ${ed.onSurface};
  font-size: 1.125rem;
  font-weight: 700;
`;

export const MediaGrid = styled.div`
  display: grid;
  gap: 6px;
  grid-template-columns: repeat(3, 1fr);
  margin-top: 8px;
`;

export const MediaThumb = styled.button`
  aspect-ratio: 1;
  background: ${ed.surfaceContainerHighest};
  border: 1px solid ${ed.outlineVariantGhost};
  border-radius: ${ed.radiusSm};
  cursor: pointer;
  overflow: hidden;
  padding: 0;

  img {
    display: block;
    height: 100%;
    object-fit: cover;
    width: 100%;
  }
`;

export const DangerOutlineBtn = styled.button`
  background: transparent;
  border: 1px solid rgba(236, 124, 138, 0.35);
  border-radius: ${ed.radiusMd};
  color: ${ed.error};
  cursor: pointer;
  font-family: ${ed.fontStack};
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  margin-top: 16px;
  padding: 10px 12px;
  text-transform: uppercase;
  width: 100%;

  &:hover {
    background: rgba(236, 124, 138, 0.08);
  }
`;

export const ThreadDrawer = styled.aside`
  background: ${ed.surfaceContainerLow};
  border-left: 1px solid ${ed.outlineVariantGhost};
  bottom: 0;
  box-shadow: -8px 0 32px rgba(0, 0, 0, 0.35);
  display: flex;
  flex-direction: column;
  max-width: 400px;
  position: absolute;
  right: 0;
  top: 0;
  width: min(400px, 100%);
  z-index: 40;

  @media (max-width: 900px) {
    max-width: 100%;
    width: 100%;
  }
`;

export const ThreadDrawerHeader = styled.div`
  align-items: center;
  border-bottom: 1px solid ${ed.outlineVariantGhost};
  display: flex;
  gap: 12px;
  justify-content: space-between;
  padding: 14px 16px;
`;

export const ThreadDrawerScroll = styled.div`
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  padding: 12px 16px;
`;

export const NotesPanel = styled.div`
  background: ${ed.surfaceContainerLow};
  border-left: 1px solid ${ed.outlineVariantGhost};
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  min-height: 0;
  width: 300px;

  @media (max-width: 1100px) {
    display: none;
  }
`;

export const NotesHeader = styled.div`
  border-bottom: 1px solid ${ed.outlineVariantGhost};
  padding: 16px;
`;

export const NotesTitle = styled.span`
  color: ${ed.primary};
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
`;

export const NotesScroll = styled.div`
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  padding: 12px 16px;
`;

export const NoteCard = styled.div`
  background: rgba(0, 0, 0, 0.25);
  border-left: 2px solid ${ed.primary};
  border-radius: ${ed.radiusMd};
  font-size: 0.8rem;
  line-height: 1.45;
  margin-bottom: 12px;
  padding: 12px;
`;

export const NotesInputRow = styled.div`
  border-top: 1px solid ${ed.outlineVariantGhost};
  padding: 12px 16px 16px;
`;

export const NotesField = styled.textarea`
  background: ${ed.surfaceContainerLowest};
  border: 1px solid ${ed.outlineVariantGhost};
  border-radius: ${ed.radiusMd};
  color: ${ed.onSurface};
  font-family: ${ed.fontStack};
  font-size: 0.8rem;
  min-height: 64px;
  padding: 10px 12px;
  resize: vertical;
  width: 100%;

  &:focus {
    border-color: rgba(194, 193, 255, 0.45);
    outline: none;
  }
`;

export const GlassControlBar = styled.div`
  align-items: center;
  backdrop-filter: ${ed.glassBlur};
  background: ${ed.glassPanel};
  border: 1px solid ${ed.outlineVariantGhost};
  border-radius: ${ed.radiusFull};
  bottom: 28px;
  box-shadow: ${ed.shadowElevated};
  display: flex;
  gap: 12px;
  left: 50%;
  padding: 10px 18px;
  position: absolute;
  transform: translateX(-50%);
  z-index: 30;
`;

export const RoundCtrl = styled.button`
  align-items: center;
  background: ${ed.surfaceContainerHighest};
  border: none;
  border-radius: ${ed.radiusFull};
  color: ${ed.onSurface};
  cursor: pointer;
  display: inline-flex;
  height: 44px;
  justify-content: center;
  width: 44px;

  &:disabled {
    cursor: not-allowed;
    opacity: 0.4;
  }

  &:not(:disabled):hover {
    background: ${ed.surfaceBright};
  }
`;

export const LeaveCallBtn = styled.button`
  align-items: center;
  background: ${ed.error};
  border: none;
  border-radius: ${ed.radiusFull};
  color: ${ed.onError};
  cursor: pointer;
  display: inline-flex;
  font-family: ${ed.fontStack};
  font-size: 0.875rem;
  font-weight: 600;
  gap: 8px;
  padding: 0 18px;
  height: 44px;

  &:hover {
    filter: brightness(1.05);
  }
`;

export const CallStage = styled.div`
  align-items: center;
  background: ${ed.surfaceContainerLowest};
  display: flex;
  flex: 1 1 auto;
  justify-content: center;
  min-height: 0;
  position: relative;
`;

export const CallStageVideo = styled.video`
  background: #000;
  border-radius: ${ed.radiusLg};
  max-height: 100%;
  max-width: 100%;
  object-fit: contain;
`;

export const PipVideo = styled.video`
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: ${ed.radiusMd};
  bottom: 100px;
  box-shadow: ${ed.shadowElevated};
  max-height: 28vh;
  max-width: 36vw;
  object-fit: cover;
  position: absolute;
  right: 24px;
  z-index: 25;
`;

export const GroupCallGrid = styled.div`
  display: grid;
  gap: 10px;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  padding: 16px 20px 120px;
`;

export const ParticipantTile = styled.div<{ $highlight?: boolean }>`
  aspect-ratio: 1;
  background: ${ed.surfaceContainerHighest};
  border: 1px solid
    ${({ $highlight }) =>
      $highlight ? 'rgba(194, 193, 255, 0.45)' : ed.outlineVariantGhost};
  border-radius: ${ed.radiusMd};
  box-shadow: ${({ $highlight }) =>
    $highlight ? '0 0 0 2px rgba(194, 193, 255, 0.35)' : 'none'};
  overflow: hidden;
  position: relative;
`;

export const LiveBadge = styled.div`
  align-items: center;
  background: rgba(31, 32, 32, 0.82);
  backdrop-filter: ${ed.glassBlur};
  border-radius: ${ed.radiusMd};
  color: ${ed.onSurface};
  display: inline-flex;
  font-size: 0.65rem;
  font-weight: 600;
  gap: 8px;
  left: 20px;
  letter-spacing: 0.06em;
  padding: 8px 14px;
  position: absolute;
  text-transform: uppercase;
  top: 20px;
  z-index: 20;
`;

export const Dot = styled.span<{ $tone?: 'live' | 'primary' }>`
  background: ${({ $tone }) => ($tone === 'primary' ? ed.primary : ed.error)};
  border-radius: ${ed.radiusFull};
  display: inline-block;
  height: 8px;
  width: 8px;
`;

export const ModalBackdrop = styled.div`
  align-items: center;
  background: rgba(0, 0, 0, 0.55);
  display: flex;
  inset: 0;
  justify-content: center;
  padding: 24px;
  position: fixed;
  z-index: 12000;
`;

export const ModalPanel = styled.div`
  background: ${ed.surfaceContainer};
  border: 1px solid ${ed.outlineVariantGhost};
  border-radius: ${ed.radiusLg};
  max-width: 400px;
  padding: 24px;
  width: 100%;
`;

export const MsgActionRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 6px;
`;

export const SmallLinkBtn = styled.button`
  background: transparent;
  border: none;
  color: ${ed.onSurfaceVariant};
  cursor: pointer;
  font-family: ${ed.fontStack};
  font-size: 0.65rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  padding: 0;
  text-transform: uppercase;

  &:hover {
    color: ${ed.primary};
  }
`;
