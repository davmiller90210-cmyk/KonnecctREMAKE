import { styled } from '@linaria/react';
import { useLingui } from '@lingui/react/macro';
import { themeCssVariables } from 'twenty-ui/theme-constants';

import { AIChatTab } from '@/ai/components/AIChatTab';
import { useSwitchToNewAIChat } from '@/ai/hooks/useSwitchToNewAIChat';
import { useIsFeatureEnabled } from '@/workspace/hooks/useIsFeatureEnabled';
import { FeatureFlagKey } from '~/generated-metadata/graphql';

const StyledPage = styled.div`
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-height: 0;
  background: ${themeCssVariables.background.primary};
`;

const StyledPageTopBar = styled.div`
  display: flex;
  justify-content: flex-end;
  padding: ${themeCssVariables.spacing[2]} ${themeCssVariables.spacing[3]} 0;
`;

const StyledChatArea = styled.div`
  display: flex;
  flex: 1 1 auto;
  min-height: 0;
`;

const StyledDisabledState = styled.div`
  margin: auto;
  padding: ${themeCssVariables.spacing[6]};
  color: ${themeCssVariables.font.color.tertiary};
  text-align: center;
`;

const StyledResetButton = styled.button`
  margin-top: ${themeCssVariables.spacing[3]};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.sm};
  background: ${themeCssVariables.background.secondary};
  color: ${themeCssVariables.font.color.primary};
  padding: ${themeCssVariables.spacing[2]} ${themeCssVariables.spacing[3]};
  cursor: pointer;
`;

export const SuperagentsPage = () => {
  const { t } = useLingui();
  const isAiEnabled = useIsFeatureEnabled(FeatureFlagKey.IS_AI_ENABLED);
  const { switchToNewChat } = useSwitchToNewAIChat();

  if (!isAiEnabled) {
    return (
      <StyledPage>
        <StyledDisabledState>
          {t`Konnecct Superagents is not enabled for this workspace yet.`}
        </StyledDisabledState>
      </StyledPage>
    );
  }

  return (
    <StyledPage>
      <StyledPageTopBar>
        <StyledResetButton type="button" onClick={switchToNewChat}>
          {t`New prompt`}
        </StyledResetButton>
      </StyledPageTopBar>
      <StyledChatArea>
        <AIChatTab />
      </StyledChatArea>
    </StyledPage>
  );
};

