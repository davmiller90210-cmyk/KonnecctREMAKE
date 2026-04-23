import { styled } from '@linaria/react';
import { type IconComponent } from 'twenty-ui/display';
import { NotificationCounter } from 'twenty-ui/navigation';
import { themeCssVariables } from 'twenty-ui/theme-constants';

const StyledButton = styled.button<{ $active: boolean; $elevated: boolean }>`
  align-items: center;
  background: ${({ $active, $elevated }) => {
    if ($active && $elevated) {
      return `linear-gradient(90deg, ${themeCssVariables.background.transparent.blue}, ${themeCssVariables.background.transparent.lighter})`;
    }
    if ($active) {
      return themeCssVariables.background.transparent.blue;
    }
    return 'transparent';
  }};
  border: 1px solid
    ${({ $active, $elevated }) =>
      $active && $elevated
        ? themeCssVariables.border.color.blue
        : 'transparent'};
  border-radius: ${({ $elevated }) =>
    $elevated
      ? themeCssVariables.border.radius.md
      : themeCssVariables.border.radius.md};
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
  min-height: ${({ $elevated }) => ($elevated ? '36px' : '34px')};
  min-width: 0;
  padding: ${themeCssVariables.spacing[2]};
  position: relative;
  text-align: left;
  transition:
    background 0.18s ease,
    border-color 0.18s ease,
    box-shadow 0.18s ease,
    color 0.18s ease,
    transform 0.18s ease;
  width: calc(100% - ${themeCssVariables.spacing[4]});

  &::before {
    background: ${({ $active }) =>
      $active ? themeCssVariables.color.blue : 'transparent'};
    border-radius: 2px;
    bottom: 8px;
    content: '';
    left: 0;
    position: absolute;
    top: 8px;
    transition: background 0.18s ease;
    width: 3px;
  }

  &:hover {
    background: ${({ $elevated }) =>
      $elevated
        ? themeCssVariables.background.transparent.medium
        : themeCssVariables.background.transparent.light};
    box-shadow: ${({ $elevated }) =>
      $elevated ? themeCssVariables.boxShadow.light : 'none'};
    color: ${themeCssVariables.font.color.primary};
    transform: ${({ $elevated }) => ($elevated ? 'translateY(-0.5px)' : 'none')};
  }

  &:focus-visible {
    outline: 2px solid ${themeCssVariables.color.blue};
    outline-offset: 1px;
  }
`;

const StyledIconWrap = styled.span<{ $elevated: boolean }>`
  align-items: center;
  color: ${({ $elevated }) =>
    $elevated
      ? themeCssVariables.color.blue
      : themeCssVariables.font.color.tertiary};
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
  surface?: 'default' | 'elevated';
};

export const ChatConversationRow = ({
  label,
  Icon,
  active,
  unread,
  onClick,
  surface = 'default',
}: ChatConversationRowProps) => {
  const elevated = surface === 'elevated';

  return (
    <StyledButton
      type="button"
      $active={active}
      $elevated={elevated}
      onClick={onClick}
    >
      <StyledIconWrap $elevated={elevated}>
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
