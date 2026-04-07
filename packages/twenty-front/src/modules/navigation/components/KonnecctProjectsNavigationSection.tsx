import { useLingui } from '@lingui/react/macro';
import { useLocation } from 'react-router-dom';
import { AppPath } from 'twenty-shared/types';
import { AnimatedExpandableContainer } from 'twenty-ui/layout';

import { NavigationDrawerAnimatedCollapseWrapper } from '@/ui/navigation/navigation-drawer/components/NavigationDrawerAnimatedCollapseWrapper';
import { NavigationDrawerSection } from '@/ui/navigation/navigation-drawer/components/NavigationDrawerSection';
import { NavigationDrawerSectionTitle } from '@/ui/navigation/navigation-drawer/components/NavigationDrawerSectionTitle';
import { NavigationDrawerSubItem } from '@/ui/navigation/navigation-drawer/components/NavigationDrawerSubItem';
import { useNavigationSection } from '@/ui/navigation/navigation-drawer/hooks/useNavigationSection';
import { isNavigationSectionOpenFamilyState } from '@/ui/navigation/navigation-drawer/states/isNavigationSectionOpenFamilyState';
import { useAtomFamilyStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomFamilyStateValue';

export const KonnecctProjectsNavigationSection = () => {
  const { t } = useLingui();
  const location = useLocation();

  const childRoutes: { label: string; to: string }[] = [
    { label: t`Home`, to: `${AppPath.Projects}` },
    { label: t`Projects`, to: `${AppPath.Projects}/projects` },
  ];
  const { toggleNavigationSection } = useNavigationSection('KonnecctProjects');
  const isNavigationSectionOpen = useAtomFamilyStateValue(
    isNavigationSectionOpenFamilyState,
    'KonnecctProjects',
  );

  return (
    <NavigationDrawerSection>
      <NavigationDrawerAnimatedCollapseWrapper>
        <NavigationDrawerSectionTitle
          label={t`Konnecct Projects`}
          onClick={toggleNavigationSection}
          isOpen={isNavigationSectionOpen}
        />
      </NavigationDrawerAnimatedCollapseWrapper>
      <AnimatedExpandableContainer
        isExpanded={isNavigationSectionOpen}
        dimension="height"
        mode="fit-content"
        containAnimation
        initial={false}
      >
        {childRoutes.map(({ label, to }) => (
          <NavigationDrawerSubItem
            key={to}
            label={label}
            to={to}
            active={
              to === AppPath.Projects
                ? location.pathname === AppPath.Projects ||
                  location.pathname === `${AppPath.Projects}/`
                : location.pathname === to ||
                  location.pathname.startsWith(`${to}/`)
            }
          />
        ))}
      </AnimatedExpandableContainer>
    </NavigationDrawerSection>
  );
};
