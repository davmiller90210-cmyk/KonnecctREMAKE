import { useLingui } from '@lingui/react/macro';
import { styled } from '@linaria/react';
import { Callout } from 'twenty-ui/display';
import { themeCssVariables } from 'twenty-ui/theme-constants';

const StyledRoot = styled.div`
  box-sizing: border-box;
  margin: 0 auto;
  max-width: 520px;
  padding: ${themeCssVariables.spacing[6]};
  width: 100%;
`;

/** Legacy `/projects/*` shell route; Plane (Konnecct Projects) is no longer deployed. */
export const KonnecctProjectsEmbed = () => {
  const { t } = useLingui();

  return (
    <StyledRoot>
      <Callout
        variant="info"
        title={t`Projects`}
        description={t`Konnecct Projects is not available in this deployment.`}
      />
    </StyledRoot>
  );
};
