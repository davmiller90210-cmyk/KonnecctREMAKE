import { styled } from '@linaria/react';
import {
  IconBell,
  IconFile,
  IconInbox,
  IconLayoutGrid,
  IconPlus,
} from 'twenty-ui/display';
import { IconButton } from 'twenty-ui/input';
import { themeCssVariables } from 'twenty-ui/theme-constants';

import { CHAT_ACCENT_GRADIENT } from '@/chat/constants/chatAccentTheme';
import { GradientAvatar } from '@/chat/components/GradientAvatar';

const StyledRail = styled.aside`
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 56px;
  flex-shrink: 0;
  padding: ${themeCssVariables.spacing[3]} ${themeCssVariables.spacing[2]};
  border-right: 1px solid ${themeCssVariables.border.color.medium};
  background: ${themeCssVariables.background.secondary};
  gap: ${themeCssVariables.spacing[2]};
`;

const StyledDots = styled.div`
  display: flex;
  gap: 4px;
  margin-bottom: ${themeCssVariables.spacing[2]};
  opacity: 0.45;
`;

const StyledDot = styled.span<{ $c: string }>`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: ${({ $c }) => $c};
`;

const StyledSpacer = styled.div`
  flex: 1 1 auto;
  min-height: ${themeCssVariables.spacing[4]};
`;

const StyledFabWrap = styled.div`
  border-radius: ${themeCssVariables.border.radius.md};
  padding: 2px;
  background: ${CHAT_ACCENT_GRADIENT};
`;

const StyledFabInner = styled.button`
  width: 40px;
  height: 40px;
  border: none;
  border-radius: ${themeCssVariables.border.radius.sm};
  background: ${themeCssVariables.background.secondary};
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: ${themeCssVariables.font.color.primary};

  &:hover {
    background: ${themeCssVariables.background.transparent.light};
  }
`;

type ChatRailProps = {
  viewerLabel: string;
  onCompose: () => void;
};

export const ChatRail = ({ viewerLabel, onCompose }: ChatRailProps) => {
  return (
    <StyledRail aria-label="Chat shortcuts">
      <StyledDots aria-hidden>
        <StyledDot $c="#ff5f57" />
        <StyledDot $c="#febc2e" />
        <StyledDot $c="#28c840" />
      </StyledDots>
      <IconButton
        Icon={IconLayoutGrid}
        variant="tertiary"
        size="small"
        ariaLabel="Overview"
      />
      <IconButton
        Icon={IconInbox}
        variant="tertiary"
        size="small"
        ariaLabel="Inbox"
      />
      <IconButton
        Icon={IconFile}
        variant="tertiary"
        size="small"
        ariaLabel="Files"
      />
      <IconButton
        Icon={IconBell}
        variant="tertiary"
        size="small"
        ariaLabel="Notifications"
      />
      <StyledSpacer />
      <GradientAvatar label={viewerLabel} size={36} />
      <StyledFabWrap>
        <StyledFabInner type="button" onClick={onCompose} aria-label="New message">
          <IconPlus />
        </StyledFabInner>
      </StyledFabWrap>
    </StyledRail>
  );
};
