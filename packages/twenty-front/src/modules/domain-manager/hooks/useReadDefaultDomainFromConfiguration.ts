import { isMultiWorkspaceEnabledState } from '@/client-config/states/isMultiWorkspaceEnabledState';
import { domainConfigurationState } from '@/domain-manager/states/domainConfigurationState';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import { isDefined } from 'twenty-shared/utils';

const computeMultiWorkspaceDefaultDomain = (
  defaultSubdomain: string | undefined,
  frontDomain: string,
  isMultiWorkspacePublicUrlShared: boolean,
): string => {
  if (isMultiWorkspacePublicUrlShared) {
    return frontDomain;
  }

  if (!isDefined(defaultSubdomain) || !isDefined(frontDomain)) {
    return frontDomain;
  }

  // Server sends frontDomain as full host (e.g. app.example.com). Do not prepend
  // defaultSubdomain again or we get app.app.example.com.
  if (frontDomain.startsWith(`${defaultSubdomain}.`)) {
    return frontDomain;
  }

  return `${defaultSubdomain}.${frontDomain}`;
};

export const useReadDefaultDomainFromConfiguration = () => {
  const domainConfiguration = useAtomStateValue(domainConfigurationState);
  const isMultiWorkspaceEnabled = useAtomStateValue(
    isMultiWorkspaceEnabledState,
  );

  const defaultDomain = isMultiWorkspaceEnabled
    ? computeMultiWorkspaceDefaultDomain(
        domainConfiguration.defaultSubdomain,
        domainConfiguration.frontDomain,
        domainConfiguration.isMultiWorkspacePublicUrlShared === true,
      )
    : domainConfiguration.frontDomain;

  return {
    defaultDomain,
  };
};
