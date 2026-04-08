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
import { dispatchAgentChatSendMessageEvent } from '@/ai/utils/dispatchAgentChatSendMessageEvent';
import { IconSettingsAutomation, IconSparkles } from 'twenty-ui/display';

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
  padding: ${themeCssVariables.spacing[2]} ${themeCssVariables.spacing[3]} 0;
`;

const StyledChatArea = styled.div`
  display: flex;
  flex: 1 1 auto;
  min-height: 0;
`;

const StyledResetButton = styled.button`
  align-self: flex-end;
  border: none;
  border-radius: 999px;
  background: transparent;
  color: ${themeCssVariables.font.color.light};
  padding: ${themeCssVariables.spacing[1]} ${themeCssVariables.spacing[2]};
  cursor: pointer;
  margin-bottom: ${themeCssVariables.spacing[1]};
`;

const StyledHero = styled.div`
  align-items: center;
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[1]};
`;

const StyledHeroTitle = styled.h1`
  color: ${themeCssVariables.font.color.primary};
  font-size: 46px;
  font-weight: ${themeCssVariables.font.weight.medium};
  margin: 0;
`;

const StyledModeTabs = styled.div`
  align-items: center;
  background: ${themeCssVariables.background.transparent.light};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: 999px;
  display: flex;
  padding: 2px;
`;

const StyledModeTab = styled.button<{ active: boolean }>`
  align-items: center;
  background: ${({ active }) =>
    active
      ? themeCssVariables.background.primary
      : themeCssVariables.background.transparent.light};
  border: none;
  border-radius: 999px;
  color: ${themeCssVariables.font.color.primary};
  cursor: pointer;
  display: flex;
  gap: ${themeCssVariables.spacing[1]};
  padding: ${themeCssVariables.spacing[1]} ${themeCssVariables.spacing[2]};
`;

const StyledPromptBox = styled.div`
  border-radius: 22px;
  background: linear-gradient(
    130deg,
    #4063ff 0%,
    #6a4bff 25%,
    #c74bff 50%,
    #ff5a6b 75%,
    #ff9c42 100%
  );
  max-width: 860px;
  width: 100%;
  padding: 2px;
  box-shadow: 0 0 32px rgba(115, 87, 255, 0.25);
`;

const StyledPromptInner = styled.div`
  border-radius: 20px;
  background: ${themeCssVariables.background.secondary};
  padding: ${themeCssVariables.spacing[2]};
`;

const StyledTextArea = styled.textarea`
  border: none;
  background: transparent;
  color: ${themeCssVariables.font.color.primary};
  width: 100%;
  outline: none;
  font-size: ${themeCssVariables.font.size.md};
  min-height: 108px;
  resize: vertical;
`;

const StyledPromptActions = styled.div`
  align-items: center;
  display: flex;
  justify-content: space-between;
`;

const StyledHint = styled.div`
  color: ${themeCssVariables.font.color.light};
  font-size: ${themeCssVariables.font.size.sm};
`;

const StyledQuestion = styled.div`
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.sm};
  background: ${themeCssVariables.background.transparent.light};
  color: ${themeCssVariables.font.color.secondary};
  max-width: 860px;
  width: 100%;
  padding: ${themeCssVariables.spacing[2]};
`;

const StyledChips = styled.div`
  display: flex;
  gap: ${themeCssVariables.spacing[1]};
  max-width: 860px;
  width: 100%;
  overflow-x: auto;
  margin-top: ${themeCssVariables.spacing[1]};
`;

const StyledChip = styled.button`
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: 999px;
  background: ${themeCssVariables.background.secondary};
  color: ${themeCssVariables.font.color.primary};
  cursor: pointer;
  padding: ${themeCssVariables.spacing[1]} ${themeCssVariables.spacing[2]};
  white-space: nowrap;
`;

const StyledSendButton = styled.button`
  align-items: center;
  background: ${themeCssVariables.background.tertiary};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: 999px;
  color: ${themeCssVariables.font.color.primary};
  cursor: pointer;
  display: flex;
  justify-content: center;
  min-height: 34px;
  min-width: 34px;
  padding: 0 ${themeCssVariables.spacing[2]};
`;

const getFallbackLabelFromPrompt = (prompt: string) => {
  const firstLine = (prompt.split('\n')[0] ?? '').trim();

  if (!firstLine) {
    return 'New Superagent';
  }

  return firstLine.length > 40 ? `${firstLine.slice(0, 40).trim()}...` : firstLine;
};

const AGENT_BUILDER_QUESTIONS = [
  'What scope should this agent handle?',
  'Any strict rules or forbidden actions?',
  'When should it escalate to you instead of acting?',
] as const;

type BuilderAnswers = {
  goal: string;
  scope: string;
  rules: string;
  escalation: string;
};

export const SuperagentsPage = () => {
  const { t } = useLingui();
  const { switchToNewChat } = useSwitchToNewAIChat();
  const { enqueueErrorSnackBar } = useSnackBar();
  const setAgentChatInput = useSetAtomState(agentChatInputState);
  const [createAgent] = useMutation(CreateOneAgentDocument);
  const [mode, setMode] = useState<'ask' | 'agents'>('agents');
  const [draft, setDraft] = useState('');
  const [builderAnswers, setBuilderAnswers] = useState<BuilderAnswers | null>(null);
  const [builderStep, setBuilderStep] = useState(0);
  const [isCreating, setIsCreating] = useState(false);

  const hasGoal = builderAnswers !== null;
  const isBuilderReady = hasGoal && builderStep >= AGENT_BUILDER_QUESTIONS.length;
  const canSend = draft.trim().length > 0 && !isCreating;
  const builderQuestion =
    hasGoal && !isBuilderReady ? AGENT_BUILDER_QUESTIONS[builderStep] : null;

  const submitAskModePrompt = () => {
    const text = draft.trim();

    if (!text) {
      return;
    }

    switchToNewChat();
    setAgentChatInput(text);
    dispatchAgentChatSendMessageEvent();
    setDraft('');
  };

  const submitBuilderAnswer = () => {
    const text = draft.trim();

    if (!text) {
      return;
    }

    if (!builderAnswers) {
      setBuilderAnswers({
        goal: text,
        scope: '',
        rules: '',
        escalation: '',
      });
      setBuilderStep(0);
      setDraft('');
      return;
    }

    const nextAnswers = { ...builderAnswers };

    if (builderStep === 0) {
      nextAnswers.scope = text;
    } else if (builderStep === 1) {
      nextAnswers.rules = text;
    } else if (builderStep === 2) {
      nextAnswers.escalation = text;
    }

    setBuilderAnswers(nextAnswers);
    setBuilderStep((prev) => prev + 1);
    setDraft('');
  };

  const handleSubmitPrompt = () => {
    if (!canSend) {
      return;
    }

    if (mode === 'ask') {
      submitAskModePrompt();
      return;
    }

    submitBuilderAnswer();
  };

  const handleStartFromScratch = () => {
    setMode('agents');
    setDraft('');
    setBuilderAnswers(null);
    setBuilderStep(0);
    switchToNewChat();
  };

  const handleCreateByPrompt = async () => {
    if (!builderAnswers || !isBuilderReady || isCreating) {
      return;
    }

    const normalizedLabel = getFallbackLabelFromPrompt(builderAnswers.goal);
    const normalizedName = computeMetadataNameFromLabel(normalizedLabel);
    const assignedLook = pickSuperagentLook(`${normalizedName}-${normalizedLabel}`);

    const augmentedPrompt = [
      builderAnswers.goal,
      builderAnswers.scope ? `\nScope details:\n${builderAnswers.scope}` : '',
      builderAnswers.rules ? `\nRules and constraints:\n${builderAnswers.rules}` : '',
      builderAnswers.escalation
        ? `\nEscalation policy:\n${builderAnswers.escalation}`
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
      dispatchAgentChatSendMessageEvent();

      setDraft('');
      setBuilderAnswers(null);
      setBuilderStep(0);
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
        <StyledHero>
          <StyledHeroTitle>{t`Super Agents`}</StyledHeroTitle>
          <StyledModeTabs>
            <StyledModeTab active={mode === 'ask'} onClick={() => setMode('ask')}>
              <IconSparkles size={14} />
              {t`Ask`}
            </StyledModeTab>
            <StyledModeTab active={mode === 'agents'} onClick={() => setMode('agents')}>
              <IconSettingsAutomation size={14} />
              {t`Agents`}
            </StyledModeTab>
          </StyledModeTabs>
          <StyledPromptBox>
            <StyledPromptInner>
              <StyledTextArea
                placeholder={
                  mode === 'agents'
                    ? t`Share the repetitive work you'd love to delegate...`
                    : t`Ask, search, or create anything...`
                }
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
              />
              <StyledPromptActions>
                <StyledHint>
                  {mode === 'agents'
                    ? isBuilderReady
                      ? t`Ready to create your superagent`
                      : t`Talk to AI to define your superagent`
                    : t`Press send to chat`}
                </StyledHint>
                <StyledSendButton onClick={handleSubmitPrompt} disabled={!canSend}>
                  {t`Send`}
                </StyledSendButton>
              </StyledPromptActions>
            </StyledPromptInner>
          </StyledPromptBox>
          {mode === 'agents' && builderQuestion && (
            <StyledQuestion>{builderQuestion}</StyledQuestion>
          )}
          {mode === 'agents' && isBuilderReady && (
            <Button
              title={isCreating ? t`Creating...` : t`Create superagent`}
              onClick={handleCreateByPrompt}
              disabled={isCreating}
            />
          )}
          {mode === 'agents' && !hasGoal && (
            <StyledChips>
              <StyledChip onClick={() => setDraft('Qualify inbound leads and book demos')}>
                {t`Support Triage`}
              </StyledChip>
              <StyledChip onClick={() => setDraft('Handle refund policy checks and responses')}>
                {t`Refund Policy`}
              </StyledChip>
              <StyledChip onClick={() => setDraft('Flag sensitive content and escalate incidents')}>
                {t`Sensitive Content`}
              </StyledChip>
              <StyledChip onClick={() => setDraft('Diagnose account access issues')}>
                {t`Account Troubleshooter`}
              </StyledChip>
            </StyledChips>
          )}
        </StyledHero>
        <StyledResetButton type="button" onClick={handleStartFromScratch}>
          {t`Start from scratch`}
        </StyledResetButton>
      </StyledPageTopBar>
      <StyledChatArea>
        <AIChatTab />
      </StyledChatArea>
    </StyledPage>
  );
};

