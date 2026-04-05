import { styled } from '@linaria/react';

import { CHAT_ACCENT_GRADIENT } from '@/chat/constants/chatAccentTheme';
import { themeCssVariables } from 'twenty-ui/theme-constants';

const StyledRing = styled.div<{ $size: number }>`
  flex-shrink: 0;
  width: ${({ $size }) => `${$size}px`};
  height: ${({ $size }) => `${$size}px`};
  border-radius: 50%;
  padding: 2px;
  background: ${CHAT_ACCENT_GRADIENT};
  box-sizing: border-box;
`;

const StyledInner = styled.div<{ $size: number }>`
  width: 100%;
  height: 100%;
  border-radius: 50%;
  background: ${themeCssVariables.background.secondary};
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: ${({ $size }) => `${Math.max(10, Math.round($size * 0.32))}px`};
  font-weight: ${themeCssVariables.font.weight.semiBold};
  font-family: ${themeCssVariables.font.family};
  color: ${themeCssVariables.font.color.primary};
`;

type GradientAvatarProps = {
  label: string;
  size?: number;
};

export const GradientAvatar = ({ label, size = 40 }: GradientAvatarProps) => {
  const initial = label.trim().charAt(0).toUpperCase() || '?';

  return (
    <StyledRing $size={size}>
      <StyledInner $size={size - 4}>{initial}</StyledInner>
    </StyledRing>
  );
};
