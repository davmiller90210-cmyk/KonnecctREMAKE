import { styled } from '@linaria/react';
import { type ReactNode } from 'react';

import { IconChevronDown, IconChevronRight } from 'twenty-ui/display';
import { LightIconButton } from 'twenty-ui/input';
import { themeCssVariables } from 'twenty-ui/theme-constants';

const StyledRow = styled.div`
  align-items: center;
  display: flex;
  gap: ${themeCssVariables.spacing[2]};
  justify-content: space-between;
  margin: ${themeCssVariables.spacing[4]} ${themeCssVariables.spacing[3]} 0;
  padding: 0 ${themeCssVariables.spacing[1]};
`;

const StyledLeft = styled.div`
  align-items: center;
  display: flex;
  flex: 1 1 auto;
  gap: ${themeCssVariables.spacing[1]};
  min-width: 0;
`;

const StyledLabel = styled.span`
  color: ${themeCssVariables.font.color.tertiary};
  font-family: ${themeCssVariables.font.family};
  font-size: ${themeCssVariables.font.size.xs};
  font-weight: ${themeCssVariables.font.weight.semiBold};
  letter-spacing: 0.08em;
  text-transform: uppercase;
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
};

export const ChatSidebarSectionLabel = ({
  label,
  actions,
  collapse,
}: ChatSidebarSectionLabelProps) => {
  return (
    <StyledRow>
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
        <StyledLabel>{label}</StyledLabel>
      </StyledLeft>
      {actions ? <StyledActions>{actions}</StyledActions> : null}
    </StyledRow>
  );
};
