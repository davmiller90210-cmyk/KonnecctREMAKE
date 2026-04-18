import { styled } from '@linaria/react';

import { type MentionItem } from '@/chat/types/MentionItem';
import { themeCssVariables } from 'twenty-ui/theme-constants';
import { IconRobot, IconSparkles } from 'twenty-ui/display';

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

const StyledRowLabel = styled.span`
  flex: 1 1 auto;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const StyledRowSubLabel = styled.span`
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.xs};
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
              : null;

        return (
          <StyledRow
            key={`${item.kind}-${item.label}-${index}`}
            active={index === activeIndex}
            onMouseEnter={() => onHover(index)}
            onClick={() => onSelect(item)}
            type="button"
          >
            {Icon ? <Icon size={14} /> : null}
            <StyledRowLabel>{item.label}</StyledRowLabel>
            <StyledRowSubLabel>
              {item.kind === 'konnecctai'
                ? 'AI'
                : item.kind === 'agent'
                  ? 'Agent'
                  : (item.objectLabelSingular ?? '')}
            </StyledRowSubLabel>
          </StyledRow>
        );
      })}
    </StyledPopover>
  );
};
