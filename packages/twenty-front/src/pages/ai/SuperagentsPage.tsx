import { styled } from '@linaria/react';
import { useLingui } from '@lingui/react/macro';
import { useMutation } from '@apollo/client/react';
import { useCallback, useMemo, useState } from 'react';
import { themeCssVariables } from 'twenty-ui/theme-constants';
import { type ExtendedUIMessage } from 'twenty-shared/ai';

import { AIChatTab } from '@/ai/components/AIChatTab';
import { useSwitchToNewAIChat } from '@/ai/hooks/useSwitchToNewAIChat';
import { buildMentionedAgentToken } from '@/ai/utils/extractMentionedAgentToken';
import { agentChatInputState } from '@/ai/states/agentChatInputState';
import {
  AGENT_CHAT_NEW_THREAD_DRAFT_KEY,
  agentChatDraftsByThreadIdState,
} from '@/ai/states/agentChatDraftsByThreadIdState';
import { currentAIChatThreadState } from '@/ai/states/currentAIChatThreadState';
import { agentChatIsLoadingState } from '@/ai/states/agentChatIsLoadingState';
import { agentChatMessagesComponentFamilyState } from '@/ai/states/agentChatMessagesComponentFamilyState';
import { dispatchAgentChatEnsureThreadForDraftEvent } from '@/ai/utils/dispatchAgentChatEnsureThreadForDraftEvent';
import { dispatchAgentChatSendMessageEvent } from '@/ai/utils/dispatchAgentChatSendMessageEvent';
import { useSetAtomState } from '@/ui/utilities/state/jotai/hooks/useSetAtomState';
import { useAtomState } from '@/ui/utilities/state/jotai/hooks/useAtomState';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import { useAtomComponentFamilyStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomComponentFamilyStateValue';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { Button } from 'twenty-ui/input';
import {
  CreateOneAgentDocument,
  type CreateAgentInput,
} from '~/generated-metadata/graphql';
import { pickSuperagentLook } from '~/pages/settings/ai/constants/superagentLooks';
import { computeMetadataNameFromLabel } from '~/pages/settings/data-model/utils/computeMetadataNameFromLabel';
import { IconSettingsAutomation, IconSparkles } from 'twenty-ui/display';
import { turnIntoEmptyStringIfWhitespacesOnly } from '~/utils/string/turnIntoEmptyStringIfWhitespacesOnly';

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

const extractUserTextFromMessages = (messages: ExtendedUIMessage[]): string => {
  const chunks: string[] = [];

  for (const message of messages) {
    if (message.role !== 'user') {
      continue;
    }

    for (const part of message.parts ?? []) {
      if (part.type === 'text' && 'text' in part) {
        chunks.push(String((part as { text: string }).text));
      }
    }
  }

  return chunks.join('\n\n').trim();
};

const getFallbackLabelFromPrompt = (prompt: string) => {
  const firstLine = (prompt.split('\n')[0] ?? '').trim();

  if (!firstLine) {
    return 'New Superagent';
  }

  return firstLine.length > 40
    ? `${firstLine.slice(0, 40).trim()}...`
    : firstLine;
};

export const SuperagentsPage = () => {
  const { t } = useLingui();
  const { switchToNewChat } = useSwitchToNewAIChat();
  const { enqueueErrorSnackBar, enqueueSuccessSnackBar } = useSnackBar();
  const setAgentChatInput = useSetAtomState(agentChatInputState);
  const [agentChatDraftsByThreadId, setAgentChatDraftsByThreadId] =
    useAtomState(agentChatDraftsByThreadIdState);
  const [agentChatInput] = useAtomState(agentChatInputState);
  const currentAIChatThread = useAtomStateValue(currentAIChatThreadState);
  const agentChatIsLoading = useAtomStateValue(agentChatIsLoadingState);
  const [createAgent] = useMutation(CreateOneAgentDocument);

  const [mode, setMode] = useState<'ask' | 'agents'>('agents');
  const [isCreating, setIsCreating] = useState(false);

  const draftKey = currentAIChatThread ?? AGENT_CHAT_NEW_THREAD_DRAFT_KEY;

  const threadIdForMessages =
    currentAIChatThread ?? AGENT_CHAT_NEW_THREAD_DRAFT_KEY;

  const threadMessages = useAtomComponentFamilyStateValue(
    agentChatMessagesComponentFamilyState,
    { threadId: threadIdForMessages },
  );

  const conversationPrompt = useMemo(
    () => extractUserTextFromMessages(threadMessages),
    [threadMessages],
  );

  const heroText = useMemo(() => {
    const draft =
      draftKey === AGENT_CHAT_NEW_THREAD_DRAFT_KEY
        ? (agentChatDraftsByThreadId[AGENT_CHAT_NEW_THREAD_DRAFT_KEY] ??
          agentChatInput)
        : (agentChatDraftsByThreadId[draftKey] ?? agentChatInput);

    return draft;
  }, [agentChatDraftsByThreadId, agentChatInput, draftKey]);

  const syncDraft = useCallback(
    (raw: string) => {
      const text = turnIntoEmptyStringIfWhitespacesOnly(raw);

      setAgentChatInput(text);
      setAgentChatDraftsByThreadId((prev) => ({
        ...prev,
        [draftKey]: text,
      }));

      if (
        draftKey === AGENT_CHAT_NEW_THREAD_DRAFT_KEY &&
        text.trim() !== ''
      ) {
        dispatchAgentChatEnsureThreadForDraftEvent();
      }
    },
    [draftKey, setAgentChatDraftsByThreadId, setAgentChatInput],
  );

  const handleHeroChange = (value: string) => {
    syncDraft(value);
  };

  const canSend =
    heroText.trim().length > 0 && !agentChatIsLoading && !isCreating;

  const handleSend = () => {
    if (!canSend) {
      return;
    }

    dispatchAgentChatSendMessageEvent();
  };

  const handleCreateSuperagent = async () => {
    const promptSource =
      conversationPrompt.length > 0
        ? conversationPrompt
        : heroText.trim();

    if (!promptSource) {
      enqueueErrorSnackBar({
        message: t`Chat with the assistant first, or describe your superagent in the prompt box.`,
      });

      return;
    }

    const normalizedLabel = getFallbackLabelFromPrompt(promptSource);
    const normalizedName = computeMetadataNameFromLabel(normalizedLabel);
    const assignedLook = pickSuperagentLook(
      `${normalizedName}-${normalizedLabel}`,
    );

    const input: CreateAgentInput = {
      name: normalizedName,
      label: normalizedLabel,
      description: null,
      icon: assignedLook.icon,
      modelId: 'auto',
      prompt: promptSource,
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
        `${mentionToken} You are live. Introduce yourself in one short message and ask what I want to do first.`,
      );
      dispatchAgentChatSendMessageEvent();

      enqueueSuccessSnackBar({
        message: t`Superagent created`,
      });
    } catch (error) {
      enqueueErrorSnackBar({
        apolloError: error,
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleStartFromScratch = () => {
    setMode('agents');
    switchToNewChat();
  };

  return (
    <StyledPage>
      <StyledPageTopBar>
        <StyledHero>
          <StyledHeroTitle>{t`Super Agents`}</StyledHeroTitle>
          <StyledModeTabs>
            <StyledModeTab
              active={mode === 'ask'}
              type="button"
              onClick={() => setMode('ask')}
            >
              <IconSparkles size={14} />
              {t`Ask`}
            </StyledModeTab>
            <StyledModeTab
              active={mode === 'agents'}
              type="button"
              onClick={() => setMode('agents')}
            >
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
                value={heroText}
                onChange={(event) => handleHeroChange(event.target.value)}
              />
              <StyledPromptActions>
                <StyledHint>
                  {mode === 'agents'
                    ? t`Message the AI above — then create your superagent when ready`
                    : t`Press send to chat`}
                </StyledHint>
                <StyledSendButton
                  type="button"
                  onClick={handleSend}
                  disabled={!canSend}
                >
                  {t`Send`}
                </StyledSendButton>
              </StyledPromptActions>
            </StyledPromptInner>
          </StyledPromptBox>
          {mode === 'agents' && (
            <Button
              title={
                isCreating ? t`Creating...` : t`Create superagent from chat`
              }
              onClick={handleCreateSuperagent}
              disabled={isCreating || agentChatIsLoading}
            />
          )}
          {mode === 'agents' && heroText.trim() === '' && (
            <StyledChips>
              <StyledChip
                type="button"
                onClick={() =>
                  syncDraft('Qualify inbound leads and book demos')
                }
              >
                {t`Support Triage`}
              </StyledChip>
              <StyledChip
                type="button"
                onClick={() =>
                  syncDraft('Handle refund policy checks and responses')
                }
              >
                {t`Refund Policy`}
              </StyledChip>
              <StyledChip
                type="button"
                onClick={() =>
                  syncDraft('Flag sensitive content and escalate incidents')
                }
              >
                {t`Sensitive Content`}
              </StyledChip>
              <StyledChip
                type="button"
                onClick={() => syncDraft('Diagnose account access issues')}
              >
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
        <AIChatTab hideComposer />
      </StyledChatArea>
    </StyledPage>
  );
};
