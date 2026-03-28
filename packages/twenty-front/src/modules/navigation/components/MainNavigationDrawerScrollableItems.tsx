import { NavigationDrawerOpenedSection } from '@/navigation-menu-item/display/sections/components/NavigationDrawerOpenedSection';
import { NavigationDrawerWorkspaceSectionSkeletonLoader } from '@/object-metadata/components/NavigationDrawerWorkspaceSectionSkeletonLoader';

import { NavigationDrawerOtherSection } from '@/navigation/components/NavigationDrawerOtherSection';
import { styled } from '@linaria/react';
import { lazy, Suspense } from 'react';

import { themeCssVariables } from 'twenty-ui/theme-constants';

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

import { AppPath } from 'twenty-shared/types';
import { IconMessage2 } from 'twenty-ui/display';
import { NavigationDrawerItem } from '@/ui/navigation/navigation-drawer/components/NavigationDrawerItem';
import { useLingui } from '@lingui/react/macro';
import { useLocation } from 'react-router-dom';

const StyledScrollableItemsContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[3]};
`;

export const MainNavigationDrawerScrollableItems = () => {
  const { t } = useLingui();
  const location = useLocation();

  return (
    <StyledScrollableItemsContainer>
      <NavigationDrawerOpenedSection />
      <Suspense fallback={<NavigationDrawerWorkspaceSectionSkeletonLoader />}>
        <FavoritesSectionDispatcher />
        <WorkspaceSectionDispatcher />
      </Suspense>
      <NavigationDrawerItem
        label={t`Chat`}
        to={AppPath.Chat}
        Icon={IconMessage2}
        active={location.pathname === AppPath.Chat}
      />
      <NavigationDrawerOtherSection />
    </StyledScrollableItemsContainer>
  );
};
