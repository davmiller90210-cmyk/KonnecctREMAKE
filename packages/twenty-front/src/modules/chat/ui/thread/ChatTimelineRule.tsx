import { styled } from '@linaria/react';

import { themeCssVariables } from 'twenty-ui/theme-constants';

const StyledDay = styled.div`
  align-items: center;
  color: ${themeCssVariables.font.color.tertiary};
  display: flex;
  font-family: ${themeCssVariables.font.family};
  font-size: ${themeCssVariables.font.size.xs};
  font-weight: ${themeCssVariables.font.weight.semiBold};
  gap: ${themeCssVariables.spacing[3]};
  letter-spacing: 0.06em;
  margin: ${themeCssVariables.spacing[4]} 0 ${themeCssVariables.spacing[2]};
  text-transform: uppercase;

  &::before,
  &::after {
    background: linear-gradient(
      90deg,
      transparent,
      ${themeCssVariables.border.color.medium}
    );
    content: '';
    flex: 1 1 auto;
    height: 1px;
  }

  &::after {
    background: linear-gradient(
      90deg,
      ${themeCssVariables.border.color.medium},
      transparent
    );
  }
`;

const StyledNew = styled.div`
  align-items: center;
  color: ${themeCssVariables.color.blue};
  display: flex;
  font-family: ${themeCssVariables.font.family};
  font-size: ${themeCssVariables.font.size.xs};
  font-weight: ${themeCssVariables.font.weight.semiBold};
  gap: ${themeCssVariables.spacing[3]};
  letter-spacing: 0.04em;
  margin: ${themeCssVariables.spacing[3]} 0;

  &::before,
  &::after {
    background: linear-gradient(
      90deg,
      transparent,
      ${themeCssVariables.color.blue}
    );
    content: '';
    flex: 1 1 auto;
    height: 1px;
    opacity: 0.45;
  }

  &::after {
    background: linear-gradient(
      90deg,
      ${themeCssVariables.color.blue},
      transparent
    );
  }
`;

type ChatTimelineRuleProps = {
  variant: 'day' | 'new';
  label: string;
};

export const ChatTimelineRule = ({ variant, label }: ChatTimelineRuleProps) => {
  if (variant === 'new') {
    return <StyledNew>{label}</StyledNew>;
  }
  return <StyledDay>{label}</StyledDay>;
};
