/**
 * Section header for Communications — glass / gradient accent language similar to
 * community component galleries (uiverse.io, reactbits.dev), using Twenty theme tokens.
 */
import { useLingui } from '@lingui/react/macro';
import { styled } from '@linaria/react';
import { motion } from 'framer-motion';
import { useContext, type KeyboardEvent, type MouseEvent } from 'react';
import { isDefined } from 'twenty-shared/utils';
import { IconChevronRight, IconMessage } from 'twenty-ui/display';
import { ThemeContext, themeCssVariables } from 'twenty-ui/theme-constants';
import { useIsSettingsPage } from '@/navigation/hooks/useIsSettingsPage';
import { NavigationDrawerAnimatedCollapseWrapper } from '@/ui/navigation/navigation-drawer/components/NavigationDrawerAnimatedCollapseWrapper';
import { isNavigationDrawerExpandedState } from '@/ui/navigation/states/isNavigationDrawerExpanded';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';

const StyledTitleRow = styled.div`
  align-items: center;
  border-radius: ${themeCssVariables.border.radius.md};
  display: flex;
  gap: ${themeCssVariables.spacing[2]};
  justify-content: space-between;
  margin: 2px ${themeCssVariables.spacing[1]} ${themeCssVariables.spacing[2]};
  padding: ${themeCssVariables.spacing[2]} ${themeCssVariables.spacing[1]};
  position: relative;

  &::before {
    background: linear-gradient(
      90deg,
      ${themeCssVariables.color.blue},
      ${themeCssVariables.color.sky} 55%,
      ${themeCssVariables.color.blue3}
    );
    border-radius: inherit;
    content: '';
    inset: 0;
    opacity: 0.06;
    pointer-events: none;
    position: absolute;
    transition: opacity 0.2s ease;
  }

  &:hover::before {
    opacity: 0.12;
  }
`;

const StyledLeft = styled.div`
  align-items: center;
  display: flex;
  flex: 1 1 auto;
  gap: ${themeCssVariables.spacing[2]};
  min-width: 0;
  position: relative;
  z-index: 1;
`;

const StyledIconBadge = styled.span`
  align-items: center;
  background: linear-gradient(
    145deg,
    ${themeCssVariables.background.transparent.blue},
    ${themeCssVariables.background.transparent.medium}
  );
  border: 1px solid ${themeCssVariables.border.color.light};
  border-radius: ${themeCssVariables.border.radius.sm};
  box-shadow: 0 1px 0 ${themeCssVariables.background.transparent.light};
  color: ${themeCssVariables.color.blue};
  display: flex;
  flex-shrink: 0;
  height: 28px;
  justify-content: center;
  width: 28px;
`;

const StyledLabelBlock = styled.div`
  cursor: pointer;
  display: flex;
  flex: 1 1 auto;
  gap: ${themeCssVariables.spacing[1]};
  min-width: 0;
`;

const StyledLabel = styled.span`
  background: linear-gradient(
    92deg,
    ${themeCssVariables.font.color.primary} 0%,
    ${themeCssVariables.color.blue} 120%
  );
  background-clip: text;
  font-family: ${themeCssVariables.font.family};
  font-size: ${themeCssVariables.font.size.sm};
  font-weight: ${themeCssVariables.font.weight.semiBold};
  letter-spacing: -0.01em;
  -webkit-text-fill-color: transparent;
`;

const StyledChevron = styled.div`
  align-items: center;
  display: flex;
  opacity: 0.85;
`;

const MotionChevron = motion.create(IconChevronRight);

const StyledRight = styled.div`
  align-items: center;
  display: flex;
  flex-shrink: 0;
  gap: ${themeCssVariables.spacing[1]};
  position: relative;
  z-index: 1;
`;

type CommunicationsSectionHeaderProps = {
  isOpen: boolean;
  onToggle: () => void;
  rightIcon?: React.ReactNode;
};

export const CommunicationsSectionHeader = ({
  isOpen,
  onToggle,
  rightIcon,
}: CommunicationsSectionHeaderProps) => {
  const { t } = useLingui();
  const { theme } = useContext(ThemeContext);
  const isNavigationDrawerExpanded = useAtomStateValue(
    isNavigationDrawerExpandedState,
  );
  const isSettingsPage = useIsSettingsPage();

  const handleToggle = () => {
    if (isNavigationDrawerExpanded || isSettingsPage) {
      onToggle();
    }
  };

  const handleClick = (e: MouseEvent) => {
    e.stopPropagation();
    handleToggle();
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      e.stopPropagation();
      handleToggle();
    }
  };

  return (
    <NavigationDrawerAnimatedCollapseWrapper>
      <StyledTitleRow className="section-title-container">
        <StyledLeft>
          <StyledIconBadge aria-hidden>
            <IconMessage size={16} stroke={2} />
          </StyledIconBadge>
          <StyledLabelBlock
            onClick={handleClick}
            role="button"
            tabIndex={0}
            onKeyDown={handleKeyDown}
            aria-expanded={isOpen}
            aria-label={t`Communications`}
          >
            <StyledLabel>{t`Communications`}</StyledLabel>
            <StyledChevron>
              <MotionChevron
                initial={false}
                animate={{ rotate: isOpen ? 90 : 0 }}
                transition={{ duration: theme.animation.duration.normal }}
                size="12px"
                stroke={theme.icon.stroke.lg}
                color={themeCssVariables.font.color.tertiary}
              />
            </StyledChevron>
          </StyledLabelBlock>
        </StyledLeft>
        {isDefined(rightIcon) ? <StyledRight>{rightIcon}</StyledRight> : null}
      </StyledTitleRow>
    </NavigationDrawerAnimatedCollapseWrapper>
  );
};
