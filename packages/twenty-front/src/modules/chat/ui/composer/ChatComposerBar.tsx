import { styled } from '@linaria/react';
import { type ReactNode } from 'react';

import { themeCssVariables } from 'twenty-ui/theme-constants';

const StyledRoot = styled.div`
  background: linear-gradient(
    180deg,
    ${themeCssVariables.background.transparent.lighter} 0%,
    ${themeCssVariables.background.primary} 38%
  );
  border-top: 1px solid ${themeCssVariables.border.color.light};
  flex-shrink: 0;
  padding: ${themeCssVariables.spacing[3]} ${themeCssVariables.spacing[4]}
    ${themeCssVariables.spacing[4]};
  position: relative;
`;

const StyledToolbarHint = styled.div`
  color: ${themeCssVariables.font.color.tertiary};
  font-family: ${themeCssVariables.font.family};
  font-size: ${themeCssVariables.font.size.xs};
  margin-bottom: ${themeCssVariables.spacing[2]};
`;

type ChatComposerBarProps = {
  hint?: string;
  children: ReactNode;
};

export const ChatComposerBar = ({ hint, children }: ChatComposerBarProps) => {
  return (
    <StyledRoot>
      {hint ? <StyledToolbarHint>{hint}</StyledToolbarHint> : null}
      {children}
    </StyledRoot>
  );
};
