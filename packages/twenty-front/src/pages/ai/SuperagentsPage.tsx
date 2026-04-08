import { styled } from '@linaria/react';
import { useLingui } from '@lingui/react/macro';
import { useState } from 'react';
import { themeCssVariables } from 'twenty-ui/theme-constants';
import { useMutation } from '@apollo/client/react';

import { AIChatTab } from '@/ai/components/AIChatTab';
import { useSwitchToNewAIChat } from '@/ai/hooks/useSwitchToNewAIChat';
import { buildMentionedAgentToken } from '@/ai/utils/extractMentionedAgentToken';
import { agentChatInputState } from '@/ai/states/agentChatInputState';
import { useSetAtomState } from '@/ui/utilities/state/jotai/hooks/useSetAtomState';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { Button } from 'twenty-ui/input';
import { CreateOneAgentDocument, type CreateAgentInput } from '~/generated-metadata/graphql';
import { pickSuperagentLook } from '~/pages/settings/ai/constants/superagentLooks';
import { computeMetadataNameFromLabel } from '~/pages/settings/data-model/utils/computeMetadataNameFromLabel';

const StyledPage = styled.div`
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-height: 0;
  background: ${themeCssVariables.background.primary};
`;

const StyledPageTopBar = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[2]};
  padding: ${themeCssVariables.spacing[3]};
`;

const StyledChatArea = styled.div`
  display: flex;
  flex: 1 1 auto;
  min-height: 0;
`;

const StyledResetButton = styled.button`
  align-self: flex-end;
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.sm};
  background: ${themeCssVariables.background.secondary};
  color: ${themeCssVariables.font.color.primary};
  padding: ${themeCssVariables.spacing[2]} ${themeCssVariables.spacing[3]};
  cursor: pointer;
`;

const StyledCreatorCard = styled.div`
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.md};
  background: ${themeCssVariables.background.secondary};
  padding: ${themeCssVariables.spacing[3]};
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[2]};
`;

const StyledInput = styled.input`
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.sm};
  background: ${themeCssVariables.background.primary};
  color: ${themeCssVariables.font.color.primary};
  padding: ${themeCssVariables.spacing[2]};
`;

const StyledTextArea = styled.textarea`
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.sm};
  background: ${themeCssVariables.background.primary};
  color: ${themeCssVariables.font.color.primary};
  min-height: 96px;
  padding: ${themeCssVariables.spacing[2]};
  resize: vertical;
`;

const StyledActions = styled.div`
  display: flex;
  justify-content: flex-end;
`;

const getFallbackLabelFromPrompt = (prompt: string) => {
  const firstLine = (prompt.split('\n')[0] ?? '').trim();

  if (!firstLine) {
    return 'New Superagent';
  }

  return firstLine.length > 40 ? `${firstLine.slice(0, 40).trim()}...` : firstLine;
};

export const SuperagentsPage = () => {
  const { t } = useLingui();
  const { switchToNewChat } = useSwitchToNewAIChat();
  const { enqueueErrorSnackBar } = useSnackBar();
  const setAgentChatInput = useSetAtomState(agentChatInputState);
  const [createAgent] = useMutation(CreateOneAgentDocument);
  const [label, setLabel] = useState('');
  const [goalPrompt, setGoalPrompt] = useState('');
  const [followUpScope, setFollowUpScope] = useState('');
  const [followUpRules, setFollowUpRules] = useState('');
  const [followUpEscalation, setFollowUpEscalation] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const canCreate = goalPrompt.trim().length > 0 && !isCreating;

  const handleCreateByPrompt = async () => {
    if (!canCreate) {
      return;
    }

    const normalizedLabel = label.trim() || getFallbackLabelFromPrompt(goalPrompt);
    const normalizedName = computeMetadataNameFromLabel(normalizedLabel);
    const assignedLook = pickSuperagentLook(`${normalizedName}-${normalizedLabel}`);

    const augmentedPrompt = [
      goalPrompt.trim(),
      followUpScope.trim()
        ? `\nScope details:\n${followUpScope.trim()}`
        : '',
      followUpRules.trim()
        ? `\nRules and constraints:\n${followUpRules.trim()}`
        : '',
      followUpEscalation.trim()
        ? `\nEscalation policy:\n${followUpEscalation.trim()}`
        : '',
    ].join('\n');

    const input: CreateAgentInput = {
      name: normalizedName,
      label: normalizedLabel,
      description: null,
      icon: assignedLook.icon,
      modelId: 'auto',
      prompt: augmentedPrompt,
      modelConfiguration: {
        superagentProfile: {
          lookId: assignedLook.id,
          codename: assignedLook.codename,
          imageUrl: assignedLook.imageUrl,
          palette: assignedLook.palette,
        },
      },
      responseFormat: { type: 'text' },
      evaluationInputs: [],
      roleId: null,
    };

    setIsCreating(true);

    try {
      const result = await createAgent({ variables: { input } });
      const createdAgent = result.data?.createOneAgent;

      if (!createdAgent) {
        throw new Error('Agent creation did not return an agent.');
      }

      const mentionToken = buildMentionedAgentToken({
        agentId: createdAgent.id,
        agentLabel: createdAgent.label,
      });

      switchToNewChat();
      setAgentChatInput(
        `${mentionToken} Help me get started. Ask me 3 focused questions before you execute.`,
      );

      setLabel('');
      setGoalPrompt('');
      setFollowUpScope('');
      setFollowUpRules('');
      setFollowUpEscalation('');
    } catch (error) {
      enqueueErrorSnackBar({
        apolloError: error,
      });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <StyledPage>
      <StyledPageTopBar>
        <StyledCreatorCard>
          <StyledInput
            placeholder={t`Superagent name (optional)`}
            value={label}
            onChange={(event) => setLabel(event.target.value)}
          />
          <StyledTextArea
            placeholder={t`What should this superagent do?`}
            value={goalPrompt}
            onChange={(event) => setGoalPrompt(event.target.value)}
          />
          <StyledInput
            placeholder={t`Follow-up 1: What scope should it handle?`}
            value={followUpScope}
            onChange={(event) => setFollowUpScope(event.target.value)}
          />
          <StyledInput
            placeholder={t`Follow-up 2: Any strict rules to follow?`}
            value={followUpRules}
            onChange={(event) => setFollowUpRules(event.target.value)}
          />
          <StyledInput
            placeholder={t`Follow-up 3: When should it escalate to you?`}
            value={followUpEscalation}
            onChange={(event) => setFollowUpEscalation(event.target.value)}
          />
          <StyledActions>
            <Button
              title={isCreating ? t`Creating...` : t`Create superagent`}
              onClick={handleCreateByPrompt}
              disabled={!canCreate}
            />
          </StyledActions>
        </StyledCreatorCard>
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

