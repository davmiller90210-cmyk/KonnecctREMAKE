import { useLocation } from 'react-router-dom';
import { useLingui } from '@lingui/react/macro';
import { styled } from '@linaria/react';
import { lazy, Suspense } from 'react';

import { themeCssVariables } from 'twenty-ui/theme-constants';
import { IconMessage } from 'twenty-ui/display';

import { NavigationDrawerOpenedSection } from '@/navigation-menu-item/display/sections/components/NavigationDrawerOpenedSection';
import { NavigationDrawerWorkspaceSectionSkeletonLoader } from '@/object-metadata/components/NavigationDrawerWorkspaceSectionSkeletonLoader';
import { NavigationDrawerOtherSection } from '@/navigation/components/NavigationDrawerOtherSection';
import { NavigationDrawerItem } from '@/ui/navigation/navigation-drawer/components/NavigationDrawerItem';

const FavoritesSectionDispatcher = lazy(() =>
  import(
    '@/navigation-menu-item/display/sections/favorites/components/FavoritesSectionDispatcher'
  ).then((module) => ({
    default: module.FavoritesSectionDispatcher,
  })),
);

const WorkspaceSectionDispatcher = lazy(() =>
  import(
    '@/navigation-menu-item/display/sections/workspace/components/WorkspaceSectionDispatcher'
  ).then((module) => ({
    default: module.WorkspaceSectionDispatcher,
  })),
);

const StyledScrollableItemsContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[3]};
`;

export const MainNavigationDrawerScrollableItems = () => {
  const location = useLocation();
  const { t } = useLingui();

  return (
    <StyledScrollableItemsContainer>
      <NavigationDrawerOpenedSection />
      <Suspense fallback={<NavigationDrawerWorkspaceSectionSkeletonLoader />}>
        <FavoritesSectionDispatcher />
        <WorkspaceSectionDispatcher />
      </Suspense>
      
      <NavigationDrawerItem
        label={t`Chat`}
        to="/chat"
        Icon={IconMessage}
        active={location.pathname.startsWith('/chat')}
      />

      <NavigationDrawerOtherSection />
    </StyledScrollableItemsContainer>
  );
};
