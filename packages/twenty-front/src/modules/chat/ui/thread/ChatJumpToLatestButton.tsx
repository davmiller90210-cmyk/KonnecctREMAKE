import { styled } from '@linaria/react';

import { IconArrowDown } from 'twenty-ui/display';
import { themeCssVariables } from 'twenty-ui/theme-constants';

const StyledButton = styled.button`
  align-items: center;
  background: ${themeCssVariables.background.primary};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.pill};
  bottom: ${themeCssVariables.spacing[4]};
  box-shadow: ${themeCssVariables.boxShadow.strong};
  color: ${themeCssVariables.color.blue};
  cursor: pointer;
  display: inline-flex;
  font-family: ${themeCssVariables.font.family};
  font-size: ${themeCssVariables.font.size.sm};
  font-weight: ${themeCssVariables.font.weight.semiBold};
  gap: ${themeCssVariables.spacing[2]};
  padding: ${themeCssVariables.spacing[2]} ${themeCssVariables.spacing[3]};
  position: absolute;
  right: ${themeCssVariables.spacing[5]};
  transition:
    background 0.15s ease,
    border-color 0.15s ease,
    transform 0.15s ease;
  z-index: 4;

  &:hover {
    background: ${themeCssVariables.background.transparent.blue};
    border-color: ${themeCssVariables.border.color.blue};
    transform: translateY(-1px);
  }
`;

type ChatJumpToLatestButtonProps = {
  label: string;
  onClick: () => void;
};

export const ChatJumpToLatestButton = ({
  label,
  onClick,
}: ChatJumpToLatestButtonProps) => {
  return (
    <StyledButton type="button" onClick={onClick}>
      <IconArrowDown size={16} stroke={2} />
      {label}
    </StyledButton>
  );
};
