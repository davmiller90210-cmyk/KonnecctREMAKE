import { type ReactNode } from 'react';
import { styled } from '@linaria/react';
import { themeCssVariables } from 'twenty-ui/theme-constants';

const StyledBackdrop = styled.div`
  align-items: center;
  background: ${themeCssVariables.background.overlayPrimary};
  display: flex;
  inset: 0;
  justify-content: center;
  padding: ${themeCssVariables.spacing[4]};
  position: fixed;
  z-index: 10000;
`;

const StyledPanel = styled.div<{ $maxWidth: number }>`
  background: ${themeCssVariables.background.primary};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.md};
  box-shadow: ${themeCssVariables.boxShadow.strong};
  display: flex;
  flex-direction: column;
  font-family: ${themeCssVariables.font.family};
  gap: ${themeCssVariables.spacing[4]};
  max-height: min(90vh, 720px);
  max-width: ${({ $maxWidth }) => `${$maxWidth}px`};
  overflow: hidden;
  padding: ${themeCssVariables.spacing[5]};
  width: 100%;
`;

const StyledTitle = styled.h2`
  color: ${themeCssVariables.font.color.primary};
  font-size: ${themeCssVariables.font.size.lg};
  font-weight: ${themeCssVariables.font.weight.semiBold};
  line-height: 1.3;
  margin: 0;
`;

export type ChatModalShellProps = {
  isOpen: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  /** Panel max-width in px */
  maxWidth?: number;
  /** Accessible name when there is no visible title */
  ariaLabel?: string;
};

export const ChatModalShell = ({
  isOpen,
  onClose,
  title,
  children,
  maxWidth = 440,
  ariaLabel,
}: ChatModalShellProps) => {
  if (!isOpen) {
    return null;
  }

  return (
    <StyledBackdrop
      aria-label={ariaLabel}
      aria-modal="true"
      role="dialog"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <StyledPanel $maxWidth={maxWidth} onClick={(e) => e.stopPropagation()}>
        {title != null && title !== false ? <StyledTitle>{title}</StyledTitle> : null}
        {children}
      </StyledPanel>
    </StyledBackdrop>
  );
};
