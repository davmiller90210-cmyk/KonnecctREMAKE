import { styled } from '@linaria/react';
import { type ReactNode } from 'react';

import { themeCssVariables } from 'twenty-ui/theme-constants';

const StyledRoot = styled.div`
  background: ${themeCssVariables.background.primary};
  border: 1px solid ${themeCssVariables.border.color.light};
  border-radius: ${themeCssVariables.border.radius.xl};
  box-shadow: ${themeCssVariables.boxShadow.light};
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-height: 0;
  min-width: 0;
  overflow: hidden;
  position: relative;

  &::before {
    background: linear-gradient(
      90deg,
      ${themeCssVariables.background.transparent.blue},
      transparent 55%
    );
    content: '';
    height: 1px;
    left: 0;
    opacity: 0.45;
    pointer-events: none;
    position: absolute;
    right: 0;
    top: 0;
    z-index: 1;
  }
`;

const StyledBody = styled.div`
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-height: 0;
  position: relative;
  z-index: 0;
`;

type ChatThreadFrameProps = {
  children: ReactNode;
};

/** Primary canvas for the active conversation (Slack-style “pane”, Twenty tokens). */
export const ChatThreadFrame = ({ children }: ChatThreadFrameProps) => {
  return (
    <StyledRoot>
      <StyledBody>{children}</StyledBody>
    </StyledRoot>
  );
};
