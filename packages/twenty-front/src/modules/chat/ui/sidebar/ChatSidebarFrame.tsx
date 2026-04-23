import { styled } from '@linaria/react';
import { type ReactNode } from 'react';

import { MOBILE_VIEWPORT, themeCssVariables } from 'twenty-ui/theme-constants';

const StyledRoot = styled.div`
  background: ${themeCssVariables.background.secondary};
  border: 1px solid ${themeCssVariables.border.color.light};
  border-radius: ${themeCssVariables.border.radius.xl};
  box-shadow: ${themeCssVariables.boxShadow.light};
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  min-width: 0;
  overflow: hidden;
  position: relative;

  &::after {
    background: linear-gradient(
      180deg,
      ${themeCssVariables.background.radialGradient} 0%,
      transparent 42%
    );
    content: '';
    height: 72px;
    left: 0;
    opacity: 0.35;
    pointer-events: none;
    position: absolute;
    right: 0;
    top: 0;
  }
`;

const StyledMobileHeader = styled.div`
  align-items: center;
  border-bottom: 1px solid ${themeCssVariables.border.color.light};
  display: none;
  flex-shrink: 0;
  font-family: ${themeCssVariables.font.family};
  font-size: ${themeCssVariables.font.size.sm};
  font-weight: ${themeCssVariables.font.weight.semiBold};
  justify-content: space-between;
  padding: ${themeCssVariables.spacing[3]} ${themeCssVariables.spacing[3]}
    ${themeCssVariables.spacing[2]};
  position: relative;
  z-index: 1;

  @media (max-width: ${MOBILE_VIEWPORT}px) {
    display: flex;
  }
`;

const StyledBody = styled.div`
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-height: 0;
  position: relative;
  z-index: 1;
`;

type ChatSidebarFrameProps = {
  mobileHeader?: ReactNode;
  children: ReactNode;
};

export const ChatSidebarFrame = ({
  mobileHeader,
  children,
}: ChatSidebarFrameProps) => {
  return (
    <StyledRoot>
      {mobileHeader ? (
        <StyledMobileHeader>{mobileHeader}</StyledMobileHeader>
      ) : null}
      <StyledBody>{children}</StyledBody>
    </StyledRoot>
  );
};
