import { styled } from '@linaria/react';

import { themeCssVariables } from 'twenty-ui/theme-constants';

export type ChatSlashCommandItem = {
  id: string;
  label: string;
  description: string;
};

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

const StyledRow = styled.button<{ $active: boolean }>`
  align-items: flex-start;
  background: ${({ $active }) =>
    $active ? themeCssVariables.background.transparent.light : 'transparent'};
  border: none;
  border-radius: ${themeCssVariables.border.radius.sm};
  color: ${themeCssVariables.font.color.primary};
  cursor: pointer;
  display: flex;
  flex-direction: column;
  font-family: ${themeCssVariables.font.family};
  gap: 2px;
  padding: ${themeCssVariables.spacing[1]} ${themeCssVariables.spacing[2]};
  text-align: left;
  width: 100%;

  &:hover {
    background: ${themeCssVariables.background.transparent.light};
  }
`;

const StyledLabel = styled.span`
  font-size: ${themeCssVariables.font.size.sm};
  font-weight: ${themeCssVariables.font.weight.medium};
`;

const StyledDesc = styled.span`
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.xs};
`;

type ChatSlashCommandPopoverProps = {
  items: ChatSlashCommandItem[];
  activeIndex: number;
  onSelect: (item: ChatSlashCommandItem) => void;
  onHover: (index: number) => void;
};

export const ChatSlashCommandPopover = ({
  items,
  activeIndex,
  onSelect,
  onHover,
}: ChatSlashCommandPopoverProps) => {
  if (items.length === 0) {
    return null;
  }

  return (
    <StyledPopover role="listbox" aria-label="Slash commands">
      {items.map((item, index) => (
        <StyledRow
          key={item.id}
          type="button"
          role="option"
          aria-selected={index === activeIndex}
          $active={index === activeIndex}
          onMouseEnter={() => {
            onHover(index);
          }}
          onClick={() => {
            onSelect(item);
          }}
        >
          <StyledLabel>{item.label}</StyledLabel>
          <StyledDesc>{item.description}</StyledDesc>
        </StyledRow>
      ))}
    </StyledPopover>
  );
};
