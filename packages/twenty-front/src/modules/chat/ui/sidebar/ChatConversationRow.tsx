import { styled } from '@linaria/react';
import { type IconComponent } from 'twenty-ui/display';
import { NotificationCounter } from 'twenty-ui/navigation';
import { themeCssVariables } from 'twenty-ui/theme-constants';

const StyledButton = styled.button<{ $active: boolean }>`
  align-items: center;
  background: ${({ $active }) =>
    $active ? themeCssVariables.background.transparent.blue : 'transparent'};
  border: none;
  border-radius: ${themeCssVariables.border.radius.md};
  box-sizing: border-box;
  color: ${({ $active }) =>
    $active
      ? themeCssVariables.font.color.primary
      : themeCssVariables.font.color.secondary};
  cursor: pointer;
  display: flex;
  font-family: ${themeCssVariables.font.family};
  font-size: ${themeCssVariables.font.size.sm};
  font-weight: ${({ $active }) =>
    $active
      ? themeCssVariables.font.weight.semiBold
      : themeCssVariables.font.weight.regular};
  gap: ${themeCssVariables.spacing[2]};
  margin: 1px ${themeCssVariables.spacing[2]};
  min-height: 34px;
  min-width: 0;
  padding: ${themeCssVariables.spacing[2]} ${themeCssVariables.spacing[2]};
  position: relative;
  text-align: left;
  transition:
    background 0.12s ease,
    color 0.12s ease,
    transform 0.12s ease;
  width: calc(100% - ${themeCssVariables.spacing[4]});

  &::before {
    background: ${({ $active }) =>
      $active ? themeCssVariables.color.blue : 'transparent'};
    border-radius: 2px;
    bottom: 6px;
    content: '';
    left: 0;
    position: absolute;
    top: 6px;
    transition: background 0.15s ease;
    width: 3px;
  }

  &:hover {
    background: ${themeCssVariables.background.transparent.light};
    color: ${themeCssVariables.font.color.primary};
  }

  &:focus-visible {
    outline: 2px solid ${themeCssVariables.color.blue};
    outline-offset: 1px;
  }
`;

const StyledIconWrap = styled.span`
  align-items: center;
  color: ${themeCssVariables.font.color.tertiary};
  display: inline-flex;
  flex-shrink: 0;
`;

const StyledLabel = styled.span<{ $unread: boolean }>`
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: ${({ $unread }) =>
    $unread ? themeCssVariables.font.color.primary : 'inherit'};
`;

const StyledBadgeWrap = styled.span`
  flex-shrink: 0;
  transform: scale(0.92);
  transform-origin: center right;
`;

type ChatConversationRowProps = {
  label: string;
  Icon: IconComponent;
  active: boolean;
  unread: number;
  onClick: () => void;
};

export const ChatConversationRow = ({
  label,
  Icon,
  active,
  unread,
  onClick,
}: ChatConversationRowProps) => {
  return (
    <StyledButton type="button" $active={active} onClick={onClick}>
      <StyledIconWrap>
        <Icon size={18} stroke={1.75} />
      </StyledIconWrap>
      <StyledLabel $unread={unread > 0}>{label}</StyledLabel>
      {unread > 0 ? (
        <StyledBadgeWrap>
          <NotificationCounter count={unread} />
        </StyledBadgeWrap>
      ) : null}
    </StyledButton>
  );
};
