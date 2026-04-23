import { styled } from '@linaria/react';
import { type ReactNode } from 'react';

import { IconChevronDown, IconChevronRight } from 'twenty-ui/display';
import { LightIconButton } from 'twenty-ui/input';
import { themeCssVariables } from 'twenty-ui/theme-constants';

const StyledRow = styled.div<{ $elevated: boolean }>`
  align-items: center;
  display: flex;
  gap: ${themeCssVariables.spacing[2]};
  justify-content: space-between;
  margin: ${({ $elevated }) =>
    $elevated
      ? `${themeCssVariables.spacing[3]} ${themeCssVariables.spacing[2]} 0`
      : `${themeCssVariables.spacing[4]} ${themeCssVariables.spacing[3]} 0`};
  padding: 0 ${themeCssVariables.spacing[1]};
`;

const StyledLeft = styled.div`
  align-items: center;
  display: flex;
  flex: 1 1 auto;
  gap: ${themeCssVariables.spacing[1]};
  min-width: 0;
`;

const StyledLabel = styled.span<{ $elevated: boolean }>`
  color: ${({ $elevated }) =>
    $elevated
      ? themeCssVariables.font.color.secondary
      : themeCssVariables.font.color.tertiary};
  font-family: ${themeCssVariables.font.family};
  font-size: ${themeCssVariables.font.size.xs};
  font-weight: ${themeCssVariables.font.weight.semiBold};
  letter-spacing: ${({ $elevated }) => ($elevated ? '0.12em' : '0.08em')};
  text-transform: uppercase;

  ${({ $elevated }) =>
    $elevated
      ? `
    background: linear-gradient(90deg, ${themeCssVariables.font.color.secondary}, ${themeCssVariables.color.blue});
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
  `
      : ''}
`;

const StyledActions = styled.div`
  align-items: center;
  display: flex;
  flex-shrink: 0;
  gap: ${themeCssVariables.spacing[1]};
`;

type ChatSidebarSectionCollapse = {
  expanded: boolean;
  onToggle: () => void;
  toggleAriaLabel: string;
};

type ChatSidebarSectionLabelProps = {
  label: string;
  actions?: ReactNode;
  collapse?: ChatSidebarSectionCollapse;
  surface?: 'default' | 'elevated';
};

export const ChatSidebarSectionLabel = ({
  label,
  actions,
  collapse,
  surface = 'default',
}: ChatSidebarSectionLabelProps) => {
  const elevated = surface === 'elevated';

  return (
    <StyledRow $elevated={elevated}>
      <StyledLeft>
        {collapse ? (
          <LightIconButton
            Icon={collapse.expanded ? IconChevronDown : IconChevronRight}
            size="small"
            accent="tertiary"
            aria-expanded={collapse.expanded}
            aria-label={collapse.toggleAriaLabel}
            onClick={collapse.onToggle}
          />
        ) : null}
        <StyledLabel $elevated={elevated}>{label}</StyledLabel>
      </StyledLeft>
      {actions ? <StyledActions>{actions}</StyledActions> : null}
    </StyledRow>
  );
};
