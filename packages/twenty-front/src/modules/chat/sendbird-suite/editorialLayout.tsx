import { styled } from '@linaria/react';

import { editorialChatTheme as ed } from '@/chat/theme/editorialChatTheme';

export const StyledShell = styled.div`
  background: ${ed.surface};
  color: ${ed.onSurface};
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  font-family: ${ed.fontStack};
  height: 100vh;
  min-height: 0;
  min-width: 0;
  overflow: hidden;
`;

export const StyledGlobalTopNav = styled.header`
  align-items: center;
  background: ${ed.surface};
  border-bottom: 2px solid ${ed.surfaceContainerHighest};
  display: flex;
  flex-shrink: 0;
  height: 52px;
  justify-content: space-between;
  padding: 0 16px;
  z-index: 100;
`;

export const StyledGlobalNavLeft = styled.div`
  align-items: center;
  display: flex;
  gap: 16px;
`;

export const StyledGlobalNavBrand = styled.div`
  color: ${ed.onSurface};
  font-family: ${ed.fontStack};
  font-size: 1.125rem;
  font-weight: 800;
  letter-spacing: -0.04em;
  margin-right: 8px;
`;

export const StyledGlobalNavVerticalDivider = styled.div`
  background: ${ed.outlineVariantGhost};
  height: 20px;
  width: 1px;
`;

export const StyledGlobalNavLinks = styled.nav`
  align-items: center;
  display: flex;
  gap: 20px;
`;

export const StyledGlobalNavLink = styled.button<{ $active?: boolean }>`
  background: transparent;
  border: none;
  border-bottom: 2px solid ${({ $active }) => ($active ? ed.primary : 'transparent')};
  color: ${({ $active }) => ($active ? ed.onSurface : ed.onSurfaceVariant)};
  cursor: pointer;
  font-family: ${ed.fontStack};
  font-size: 0.75rem;
  font-weight: 700;
  height: 52px;
  letter-spacing: 0.08em;
  padding: 0 4px;
  text-transform: uppercase;
  transition: color 0.15s ease;

  &:hover {
    color: ${ed.onSurface};
  }
`;

export const StyledGlobalNavRight = styled.div`
  align-items: center;
  display: flex;
  gap: 14px;
`;

export const StyledGlobalNavAction = styled.button`
  align-items: center;
  background: transparent;
  border: none;
  color: ${ed.onSurfaceVariant};
  cursor: pointer;
  display: flex;
  padding: 4px;
  transition: color 0.15s ease;

  &:hover {
    color: ${ed.onSurface};
  }
`;

export const StyledExitChatButton = styled.button`
  align-items: center;
  background: ${ed.surfaceContainerHigh};
  border: 1px solid ${ed.outlineVariantGhost};
  border-radius: ${ed.radiusFull};
  color: ${ed.onSurfaceVariant};
  cursor: pointer;
  display: flex;
  padding: 6px;
  transition: all 0.15s ease;

  &:hover {
    background: ${ed.surfaceContainerHighest};
    border-color: ${ed.primaryMutedBorder};
    color: ${ed.error};
  }
`;

export const StyledWorkspaceRail = styled.aside`
  background: ${ed.surfaceContainerLow};
  border-right: 1px solid ${ed.outlineVariantGhost};
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  min-height: 0;
  width: 248px;
`;

export const StyledRailHeader = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 14px 14px 10px;
`;

export const StyledRailBrandTitle = styled.h1`
  color: ${ed.onSurface};
  font-size: 0.95rem;
  font-weight: 600;
  letter-spacing: -0.02em;
  margin: 0;
`;

export const StyledRailBrandMeta = styled.p`
  color: ${ed.onSurfaceVariant};
  font-size: 0.75rem;
  letter-spacing: 0.05em;
  margin: 0;
  text-transform: uppercase;
`;

export const StyledRailPrimaryCta = styled.button`
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

export const StyledRailScroll = styled.div`
  flex: 1 1 auto;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
  padding: 0 6px 8px;
`;

export const StyledRailSectionLabel = styled.div`
  color: ${ed.onSurfaceVariant};
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  padding: 10px 10px 5px;
  text-transform: uppercase;
`;

export const StyledRailNavRow = styled.button<{ $active?: boolean }>`
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

export const StyledRailChannelRow = styled.button<{ $active?: boolean }>`
  align-items: center;
  background: ${({ $active }) =>
    $active ? ed.surfaceContainerHighest : 'transparent'};
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

export const StyledRailFooter = styled.div`
  border-top: 1px solid ${ed.outlineVariantGhost};
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  gap: 4px;
  padding: 12px 8px;
`;

export const StyledRailUserRow = styled.div`
  align-items: center;
  display: flex;
  gap: 10px;
  padding: 8px 12px;
`;

export const StyledBodyRow = styled.div`
  display: flex;
  flex: 1 1 auto;
  flex-direction: row;
  min-height: 0;
  min-width: 0;
`;

export const StyledMainColumn = styled.main`
  background: ${ed.surface};
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-height: 0;
  min-width: 0;
  position: relative;
`;

export const StyledTopBar = styled.header`
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

export const StyledTopBarLeft = styled.div`
  align-items: center;
  display: flex;
  flex: 1 1 auto;
  gap: 12px;
  min-width: 0;
`;

export const StyledTopBarTitle = styled.span`
  color: ${ed.onSurface};
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  overflow: hidden;
  text-overflow: ellipsis;
  text-transform: uppercase;
  white-space: nowrap;
`;

export const StyledTopBarMeta = styled.span`
  color: ${ed.onSurfaceVariant};
  font-size: 0.72rem;
`;

export const StyledTopBarActions = styled.div`
  align-items: center;
  display: flex;
  flex-shrink: 0;
  gap: 8px;
`;

export const StyledIconButtonGhost = styled.button`
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

export const StyledIconButtonPrimary = styled.button`
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

export const StyledSearchField = styled.input`
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
    border-color: ${ed.primaryMutedBorder};
    outline: none;
  }
`;

export const StyledCenterBlock = styled.div`
  align-items: center;
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  gap: 12px;
  justify-content: center;
  padding: 32px;
  text-align: center;
`;

export const StyledCenterTitle = styled.span`
  color: ${ed.onSurface};
  font-size: 0.9375rem;
  font-weight: 600;
`;

export const StyledCenterError = styled(StyledCenterBlock)`
  color: ${ed.error};
`;

export const StyledMessageScroll = styled.div`
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  padding: 12px 14px;
  scroll-behavior: smooth;
`;

export const StyledDatePill = styled.div`
  display: flex;
  justify-content: center;
  margin: 16px 0 24px;
`;

export const StyledDatePillInner = styled.span`
  background: ${ed.surfaceContainerHigh};
  border-radius: ${ed.radiusFull};
  color: ${ed.onSurfaceVariant};
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  padding: 6px 14px;
  text-transform: uppercase;
`;

export const StyledMsgRow = styled.div<{ $own?: boolean }>`
  display: flex;
  flex-direction: ${({ $own }) => ($own ? 'row-reverse' : 'row')};
  gap: 12px;
  margin-bottom: 20px;
  max-width: min(720px, 92%);
  ${({ $own }) => ($own ? 'margin-left: auto;' : '')}
`;

export const StyledMsgStack = styled.div`
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
`;

export const StyledMsgMeta = styled.div<{ $own?: boolean }>`
  align-items: baseline;
  display: flex;
  flex-direction: ${({ $own }) => ($own ? 'row-reverse' : 'row')};
  gap: 8px;
`;

export const StyledMsgAuthor = styled.span`
  color: ${ed.onSurface};
  font-size: 0.875rem;
  font-weight: 600;
`;

export const StyledMsgTime = styled.span`
  color: ${ed.onSurfaceVariant};
  font-size: 0.65rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
`;

export const StyledMsgText = styled.div<{ $own?: boolean }>`
  background: ${({ $own }) =>
    $own ? ed.surfaceContainerHigh : ed.surfaceContainerHighest};
  border: 1px solid
    ${({ $own }) => ($own ? ed.primaryMutedBorder : ed.outlineVariantGhost)};
  border-radius: ${ed.radiusLg};
  color: ${({ $own }) => ($own ? ed.onPrimaryContainer : ed.onSurface)};
  font-size: 0.875rem;
  line-height: 1.5;
  padding: 12px 14px;
  ${({ $own }) => ($own ? 'border-top-right-radius: 4px;' : 'border-top-left-radius: 4px;')}
`;

export const StyledFileCard = styled.a`
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

export const StyledReactionRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
`;

export const StyledReactionChip = styled.button`
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
    border-color: ${ed.primaryMutedBorder};
  }
`;

export const StyledThreadHint = styled.button`
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

export const StyledTypingLine = styled.div`
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

export const StyledComposerWrap = styled.footer`
  border-top: 1px solid ${ed.outlineVariantGhost};
  flex-shrink: 0;
  padding: 10px 14px 12px;
`;

export const StyledComposerBox = styled.div`
  background: ${ed.surfaceContainerHighest};
  border: 1px solid ${ed.outlineVariantGhost};
  border-radius: ${ed.radiusLg};
  box-shadow: ${ed.shadowElevated};
  margin: 0 auto;
  max-width: 100%;
  transition: border-color 0.15s ease;

  &:focus-within {
    border-color: ${ed.primaryMutedBorder};
  }
`;

export const StyledComposerToolbar = styled.div`
  border-bottom: 1px solid ${ed.outlineVariantGhost};
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  padding: 6px 8px;
`;

export const StyledToolbarBtn = styled.button`
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

export const StyledComposerTextarea = styled.textarea`
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

export const StyledComposerBottom = styled.div`
  align-items: center;
  display: flex;
  justify-content: space-between;
  padding: 6px 8px 8px;
`;

export const StyledComposerIconGroup = styled.div`
  align-items: center;
  display: flex;
  gap: 4px;
`;

export const StyledSendFab = styled.button`
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

export const StyledDetailsColumn = styled.aside`
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

export const StyledDetailsHeader = styled.div`
  align-items: center;
  display: flex;
  justify-content: space-between;
  padding: 20px 20px 12px;
`;

export const StyledDetailsTitle = styled.h3`
  color: ${ed.onSurface};
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  margin: 0;
  text-transform: uppercase;
`;

export const StyledDetailsScroll = styled.div`
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  padding: 0 20px 20px;
`;

export const StyledBentoGrid = styled.div`
  display: grid;
  gap: 8px;
  grid-template-columns: 1fr 1fr;
  margin-bottom: 20px;
`;

export const StyledBentoCell = styled.div`
  background: ${ed.surfaceContainerHighest};
  border: 1px solid ${ed.outlineVariantGhost};
  border-radius: ${ed.radiusMd};
  padding: 12px;
`;

export const StyledBentoLabel = styled.div`
  color: ${ed.onSurfaceVariant};
  font-size: 0.6rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  margin-bottom: 4px;
  text-transform: uppercase;
`;

export const StyledBentoValue = styled.div`
  color: ${ed.onSurface};
  font-size: 1.125rem;
  font-weight: 700;
`;

export const StyledMediaGrid = styled.div`
  display: grid;
  gap: 6px;
  grid-template-columns: repeat(3, 1fr);
  margin-top: 8px;
`;

export const StyledMediaThumb = styled.button`
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

export const StyledDangerOutlineBtn = styled.button`
  background: transparent;
  border: 1px solid ${ed.primaryMutedBorder};
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
    background: ${ed.surfaceContainerHigh};
  }
`;

export const StyledThreadDrawer = styled.aside`
  background: ${ed.surfaceContainerLow};
  border-left: 1px solid ${ed.outlineVariantGhost};
  bottom: 0;
  box-shadow: ${ed.shadowElevated};
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

export const StyledThreadDrawerHeader = styled.div`
  align-items: center;
  border-bottom: 1px solid ${ed.outlineVariantGhost};
  display: flex;
  gap: 12px;
  justify-content: space-between;
  padding: 14px 16px;
`;

export const StyledThreadDrawerScroll = styled.div`
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  padding: 12px 16px;
`;

export const StyledNotesPanel = styled.div`
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

export const StyledNotesHeader = styled.div`
  border-bottom: 1px solid ${ed.outlineVariantGhost};
  padding: 16px;
`;

export const StyledNotesTitle = styled.span`
  color: ${ed.primary};
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
`;

export const StyledNotesScroll = styled.div`
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  padding: 12px 16px;
`;

export const StyledNoteCard = styled.div`
  background: ${ed.surfaceContainerLowest};
  border-left: 2px solid ${ed.primary};
  border-radius: ${ed.radiusMd};
  font-size: 0.8rem;
  line-height: 1.45;
  margin-bottom: 12px;
  padding: 12px;
`;

export const StyledNotesInputRow = styled.div`
  border-top: 1px solid ${ed.outlineVariantGhost};
  padding: 12px 16px 16px;
`;

export const StyledNotesField = styled.textarea`
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
    border-color: ${ed.primaryMutedBorder};
    outline: none;
  }
`;

export const StyledGlassControlBar = styled.div`
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

export const StyledRoundCtrl = styled.button`
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

export const StyledLeaveCallBtn = styled.button`
  align-items: center;
  background: ${ed.error};
  border: none;
  border-radius: ${ed.radiusFull};
  color: ${ed.onError};
  cursor: pointer;
  display: inline-flex;
  font-family: ${ed.fontStack};
  font-size: 0.8125rem;
  font-weight: 700;
  gap: 8px;
  height: 44px;
  padding: 0 20px;

  &:hover {
    opacity: 0.9;
  }
`;

export const StyledCallStage = styled.div`
  background: ${ed.surfaceContainerLowest};
  display: flex;
  flex: 1 1 auto;
  min-height: 0;
  position: relative;
`;

export const StyledCallStageVideo = styled.video`
  background: ${ed.surfaceContainerLowest};
  border-radius: ${ed.radiusLg};
  height: 100%;
  object-fit: cover;
  width: 100%;
`;

export const StyledPipVideo = styled.video`
  border: 1px solid ${ed.outlineVariantGhost};
  border-radius: ${ed.radiusMd};
  bottom: 20px;
  box-shadow: ${ed.shadowElevated};
  height: 120px;
  position: absolute;
  right: 20px;
  width: 160px;
  z-index: 10;
`;

export const StyledGroupCallGrid = styled.div`
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  padding: 16px;
`;

export const StyledParticipantTile = styled.div<{ $highlight?: boolean }>`
  background: ${ed.surfaceContainerHigh};
  border: 2px solid ${({ $highlight }) => ($highlight ? ed.primary : 'transparent')};
  border-radius: ${ed.radiusLg};
  position: relative;
`;

export const StyledLiveBadge = styled.div`
  align-items: center;
  background: ${ed.glassPanel};
  backdrop-filter: ${ed.glassBlur};
  border-radius: ${ed.radiusFull};
  color: ${ed.onSurface};
  display: flex;
  font-size: 0.65rem;
  font-weight: 800;
  gap: 8px;
  left: 20px;
  padding: 6px 12px;
  position: absolute;
  text-transform: uppercase;
  top: 20px;
  z-index: 20;
`;

export const StyledDot = styled.div<{ $tone?: 'live' }>`
  background: ${({ $tone }) => ($tone === 'live' ? ed.error : ed.onSurfaceVariant)};
  border-radius: 50%;
  height: 6px;
  width: 6px;
`;

export const StyledModalBackdrop = styled.div`
  align-items: center;
  background: ${ed.scrim};
  display: flex;
  inset: 0;
  justify-content: center;
  padding: 24px;
  position: fixed;
  z-index: 12000;
`;

export const StyledModalPanel = styled.div`
  background: ${ed.surfaceContainerHigh};
  border: 1px solid ${ed.outlineVariantGhost};
  border-radius: ${ed.radiusLg};
  box-shadow: ${ed.shadowElevated};
  max-width: 440px;
  padding: 32px;
  width: 100%;
`;

export const StyledMsgActionRow = styled.div`
  display: flex;
  gap: 12px;
  margin-top: 8px;
`;

export const StyledSmallLinkBtn = styled.button`
  background: transparent;
  border: none;
  color: ${ed.primary};
  cursor: pointer;
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  padding: 0;
  text-transform: uppercase;

  &:hover {
    text-decoration: underline;
  }
`;

// ─── KonnecctAI UI Tokens ─────────────────────────────────────────────────────

/**
 * Topbar AI toggle button — gradient accent when active, ghost when idle.
 * $active drives the highlighted gradient state.
 */
export const StyledAIToggleButton = styled.button<{ $active?: boolean }>`
  align-items: center;
  background: ${({ $active }) =>
    $active
      ? 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)'
      : ed.surfaceContainerHigh};
  border: 1px solid
    ${({ $active }) => ($active ? 'transparent' : ed.outlineVariantGhost)};
  border-radius: ${ed.radiusMd};
  box-shadow: ${({ $active }) =>
    $active ? '0 0 0 3px rgba(124, 58, 237, 0.22)' : 'none'};
  color: ${({ $active }) => ($active ? '#fff' : ed.primary)};
  cursor: pointer;
  display: inline-flex;
  font-family: ${ed.fontStack};
  font-size: 0.8125rem;
  font-weight: 600;
  gap: 6px;
  padding: 7px 12px;
  transition:
    background 0.18s ease,
    box-shadow 0.18s ease,
    border-color 0.18s ease;

  &:not(:disabled):hover {
    background: ${({ $active }) =>
      $active
        ? 'linear-gradient(135deg, #4338ca 0%, #6d28d9 100%)'
        : ed.surfaceContainerHighest};
  }
`;

/**
 * Sidebar AI shortcut row — always visible above channels.
 * Uses a subtle gradient left-accent to differentiate from regular nav items.
 */
export const StyledAIRailButton = styled.button<{ $active?: boolean }>`
  align-items: center;
  background: ${({ $active }) =>
    $active
      ? 'linear-gradient(90deg, rgba(79,70,229,0.18) 0%, transparent 100%)'
      : 'transparent'};
  border: none;
  border-left: 2px solid
    ${({ $active }) => ($active ? '#7c3aed' : 'transparent')};
  border-radius: 0 ${ed.radiusMd} ${ed.radiusMd} 0;
  color: ${({ $active }) => ($active ? '#c2c1ff' : ed.onSurfaceVariant)};
  cursor: pointer;
  display: flex;
  font-family: ${ed.fontStack};
  font-size: 0.875rem;
  font-weight: ${({ $active }) => ($active ? '600' : '400')};
  gap: 9px;
  margin-bottom: 2px;
  padding: 8px 10px 8px 12px;
  text-align: left;
  transition:
    background 0.15s ease,
    color 0.15s ease;
  width: 100%;

  &:hover {
    background: linear-gradient(
      90deg,
      rgba(79, 70, 229, 0.12) 0%,
      transparent 100%
    );
    color: #c2c1ff;
  }
`;

/** Animated sparkle dot shown next to "KonnecctAI" when streaming */
export const StyledAIStreamingDot = styled.span<{ $visible: boolean }>`
  background: linear-gradient(135deg, #4f46e5, #7c3aed);
  border-radius: 50%;
  display: ${({ $visible }) => ($visible ? 'inline-block' : 'none')};
  height: 6px;
  margin-left: 4px;
  width: 6px;

  @keyframes ai-pulse {
    0%,
    100% {
      opacity: 1;
      transform: scale(1);
    }
    50% {
      opacity: 0.4;
      transform: scale(0.7);
    }
  }

  animation: ai-pulse 1.2s ease-in-out infinite;
`;

// ─── Compatibility aliases ──────────────────────────────────────────────────
// Several call sites import these as `Ed.MsgRow`, `Ed.ComposerBox`, etc.
// The canonical exports above are prefixed with `Styled` — re-export under the
// short names so existing usages keep working without touching every caller.
export const MsgRow = StyledMsgRow;
export const MsgStack = StyledMsgStack;
export const MsgMeta = StyledMsgMeta;
export const MsgAuthor = StyledMsgAuthor;
export const MsgTime = StyledMsgTime;
export const MsgText = StyledMsgText;
export const MsgActionRow = StyledMsgActionRow;
export const FileCard = StyledFileCard;
export const ReactionRow = StyledReactionRow;
export const ReactionChip = StyledReactionChip;
export const SmallLinkBtn = StyledSmallLinkBtn;
export const ThreadHint = StyledThreadHint;
export const MessageScroll = StyledMessageScroll;
export const DatePill = StyledDatePill;
export const DatePillInner = StyledDatePillInner;
export const TypingLine = StyledTypingLine;
export const ComposerWrap = StyledComposerWrap;
export const ComposerBox = StyledComposerBox;
export const ComposerToolbar = StyledComposerToolbar;
export const ToolbarBtn = StyledToolbarBtn;
export const ComposerTextarea = StyledComposerTextarea;
export const ComposerBottom = StyledComposerBottom;
export const ComposerIconGroup = StyledComposerIconGroup;
export const SendFab = StyledSendFab;

