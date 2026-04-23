import { styled } from '@linaria/react';

import { type MentionItem } from '@/chat/types/MentionItem';
import { Avatar, IconRobot, IconSparkles, IconUser } from 'twenty-ui/display';
import { themeCssVariables } from 'twenty-ui/theme-constants';

const StyledPopover = styled.div`
  background: ${themeCssVariables.background.primary};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.sm};
  box-shadow: ${themeCssVariables.boxShadow.strong};
  max-height: 260px;
  overflow-y: auto;
  padding: ${themeCssVariables.spacing[1]};
  position: absolute;
  bottom: calc(100% + ${themeCssVariables.spacing[1]});
  left: ${themeCssVariables.spacing[3]};
  right: ${themeCssVariables.spacing[3]};
  z-index: 40;
`;

const StyledRow = styled.button<{ active: boolean }>`
  align-items: center;
  background: ${({ active }) =>
    active ? themeCssVariables.background.transparent.light : 'transparent'};
  border: none;
  border-radius: ${themeCssVariables.border.radius.sm};
  color: ${themeCssVariables.font.color.primary};
  cursor: pointer;
  display: flex;
  font-family: ${themeCssVariables.font.family};
  font-size: ${themeCssVariables.font.size.sm};
  gap: ${themeCssVariables.spacing[2]};
  padding: ${themeCssVariables.spacing[1]} ${themeCssVariables.spacing[2]};
  text-align: left;
  width: 100%;

  &:hover {
    background: ${themeCssVariables.background.transparent.light};
  }
`;

const StyledRowMain = styled.span`
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
`;

const StyledRowLabel = styled.span`
  font-weight: ${themeCssVariables.font.weight.medium};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const StyledRowHint = styled.span`
  color: ${themeCssVariables.font.color.secondary};
  font-size: ${themeCssVariables.font.size.xs};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const StyledRowSubLabel = styled.span`
  color: ${themeCssVariables.font.color.tertiary};
  flex-shrink: 0;
  font-size: ${themeCssVariables.font.size.xs};
  max-width: 40%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

type ChatMentionPopoverProps = {
  items: MentionItem[];
  activeIndex: number;
  onSelect: (item: MentionItem) => void;
  onHover: (index: number) => void;
};

export const ChatMentionPopover = ({
  items,
  activeIndex,
  onSelect,
  onHover,
}: ChatMentionPopoverProps) => {
  if (items.length === 0) return null;

  return (
    <StyledPopover>
      {items.map((item, index) => {
        const Icon =
          item.kind === 'konnecctai'
            ? IconSparkles
            : item.kind === 'agent'
              ? IconRobot
              : item.kind === 'user'
                ? IconUser
                : null;

        const isCrm = item.kind === 'crm';

        return (
          <StyledRow
            key={
              item.kind === 'user'
                ? `${item.kind}-${item.userId}`
                : item.kind === 'crm'
                  ? `${item.kind}-${item.objectNameSingular}-${item.recordId}`
                  : `${item.kind}-${item.label}-${index}`
            }
            active={index === activeIndex}
            onMouseEnter={() => onHover(index)}
            onClick={() => onSelect(item)}
            type="button"
          >
            {isCrm ? (
              <Avatar
                size="sm"
                placeholder={item.label}
                avatarUrl={item.imageUrl?.trim() ? item.imageUrl : null}
              />
            ) : Icon ? (
              <Icon size={14} />
            ) : null}
            {isCrm ? (
              <StyledRowMain>
                <StyledRowLabel>{item.label}</StyledRowLabel>
                <StyledRowHint>{item.objectLabelSingular}</StyledRowHint>
              </StyledRowMain>
            ) : (
              <StyledRowLabel>{item.label}</StyledRowLabel>
            )}
            <StyledRowSubLabel>
              {item.kind === 'konnecctai'
                ? 'AI'
                : item.kind === 'agent'
                  ? 'Agent'
                  : item.kind === 'user'
                    ? 'Member'
                    : item.objectNameSingular}
            </StyledRowSubLabel>
          </StyledRow>
        );
      })}
    </StyledPopover>
  );
};
