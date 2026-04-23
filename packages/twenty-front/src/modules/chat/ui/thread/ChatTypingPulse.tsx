import { styled } from '@linaria/react';

import { themeCssVariables } from 'twenty-ui/theme-constants';

const StyledWrap = styled.div`
  align-items: center;
  background: ${themeCssVariables.background.secondary};
  border: 1px solid ${themeCssVariables.border.color.light};
  border-radius: ${themeCssVariables.border.radius.pill};
  color: ${themeCssVariables.font.color.secondary};
  display: inline-flex;
  font-family: ${themeCssVariables.font.family};
  font-size: ${themeCssVariables.font.size.xs};
  gap: ${themeCssVariables.spacing[2]};
  margin: ${themeCssVariables.spacing[2]} ${themeCssVariables.spacing[4]} 0;
  padding: ${themeCssVariables.spacing[2]} ${themeCssVariables.spacing[3]};
  width: fit-content;
`;

const StyledDots = styled.span`
  display: inline-flex;
  gap: 3px;
`;

const StyledDot = styled.span<{ $delay: number }>`
  animation: chat-typing-dot 1.1s ease-in-out infinite;
  animation-delay: ${({ $delay }) => $delay}ms;
  background: ${themeCssVariables.color.blue};
  border-radius: 50%;
  height: 5px;
  width: 5px;

  @keyframes chat-typing-dot {
    0%,
    80%,
    100% {
      opacity: 0.25;
      transform: translateY(1px);
    }
    40% {
      opacity: 1;
      transform: translateY(0);
    }
  }
`;

type ChatTypingPulseProps = {
  label: string;
};

export const ChatTypingPulse = ({ label }: ChatTypingPulseProps) => {
  return (
    <StyledWrap role="status" aria-live="polite">
      <StyledDots aria-hidden>
        <StyledDot $delay={0} />
        <StyledDot $delay={120} />
        <StyledDot $delay={240} />
      </StyledDots>
      {label}
    </StyledWrap>
  );
};
