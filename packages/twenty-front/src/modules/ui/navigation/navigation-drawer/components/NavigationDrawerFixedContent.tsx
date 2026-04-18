import { type ReactNode } from 'react';

import { useIsChatDrawer } from '@/navigation/hooks/useIsChatDrawer';
import { useIsSettingsDrawer } from '@/navigation/hooks/useIsSettingsDrawer';
import { NavigationDrawerSection } from '@/ui/navigation/navigation-drawer/components/NavigationDrawerSection';
import { styled } from '@linaria/react';
import { useIsMobile } from 'twenty-ui/utilities';
import { themeCssVariables } from 'twenty-ui/theme-constants';

const StyledFixedContainer = styled.div<{
  isPadded?: boolean;
  isMobile?: boolean;
}>`
  padding-left: ${({ isPadded }) =>
    isPadded ? themeCssVariables.spacing[5] : '0'};
  padding-right: ${({ isPadded, isMobile }) =>
    isPadded
      ? isMobile
        ? themeCssVariables.spacing[5]
        : themeCssVariables.spacing[8]
      : '0'};
`;
export const NavigationDrawerFixedContent = ({
  children,
}: {
  children: ReactNode;
}) => {
  const isSettingsDrawer = useIsSettingsDrawer();
  const isChatDrawer = useIsChatDrawer();
  const isMobile = useIsMobile();

  return (
    <StyledFixedContainer
      isPadded={isSettingsDrawer || isChatDrawer}
      isMobile={isMobile}
    >
      <NavigationDrawerSection>{children}</NavigationDrawerSection>
    </StyledFixedContainer>
  );
};
