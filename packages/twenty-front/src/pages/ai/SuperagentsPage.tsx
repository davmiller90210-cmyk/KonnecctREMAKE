import { styled } from '@linaria/react';
import { useLingui } from '@lingui/react/macro';
import { useMutation } from '@apollo/client/react';
import { type KeyboardEvent, useCallback, useMemo, useState } from 'react';
import { themeCssVariables } from 'twenty-ui/theme-constants';
import { type ExtendedUIMessage } from 'twenty-shared/ai';
import { isDefined } from 'twenty-shared/utils';

import { AIChatTab } from '@/ai/components/AIChatTab';
import { useSwitchToNewAIChat } from '@/ai/hooks/useSwitchToNewAIChat';
import { buildMentionedAgentToken } from '@/ai/utils/extractMentionedAgentToken';
import { agentChatInputState } from '@/ai/states/agentChatInputState';
import {
  AGENT_CHAT_NEW_THREAD_DRAFT_KEY,
  agentChatDraftsByThreadIdState,
} from '@/ai/states/agentChatDraftsByThreadIdState';
import { currentAIChatThreadState } from '@/ai/states/currentAIChatThreadState';
import { agentChatDisplayedThreadState } from '@/ai/states/agentChatDisplayedThreadState';
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
import {
  IconArrowUp,
  IconPlus,
  IconSettingsAutomation,
  IconSparkles,
} from 'twenty-ui/display';
import { turnIntoEmptyStringIfWhitespacesOnly } from '~/utils/string/turnIntoEmptyStringIfWhitespacesOnly';

const GRADIENT_TEXT = `
  background: linear-gradient(90deg, #ff5a6b 0%, #c74bff 35%, #4063ff 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
`;

const StyledPage = styled.div`
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-height: 0;
  background: ${themeCssVariables.background.primary};
`;

const StyledShell = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  margin: 0 auto;
  max-width: 920px;
  min-height: 0;
  padding: 0 ${themeCssVariables.spacing[3]};
  position: relative;
  width: 100%;
`;

const StyledStartOver = styled.button`
  background: transparent;
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: 999px;
  color: ${themeCssVariables.font.color.light};
  cursor: pointer;
  font-size: ${themeCssVariables.font.size.sm};
  padding: ${themeCssVariables.spacing[1]} ${themeCssVariables.spacing[2]};
  position: absolute;
  right: 0;
  top: 0;
  z-index: 1;
`;

const StyledHero = styled.div`
  align-items: center;
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[3]};
  padding: ${themeCssVariables.spacing[6]} 0 ${themeCssVariables.spacing[2]};
`;

const StyledBrandRow = styled.div`
  align-items: center;
  display: flex;
  gap: ${themeCssVariables.spacing[2]};
`;

const StyledBrandMark = styled.div`
  align-items: center;
  background: linear-gradient(
    135deg,
    #ff5a6b 0%,
    #c74bff 45%,
    #4063ff 100%
  );
  border-radius: ${themeCssVariables.border.radius.sm};
  display: flex;
  height: 40px;
  justify-content: center;
  width: 40px;
`;

const StyledHeroTitle = styled.h1`
  font-size: 40px;
  font-weight: ${themeCssVariables.font.weight.semiBold};
  letter-spacing: -0.02em;
  line-height: 1.1;
  margin: 0;
  ${GRADIENT_TEXT}
`;

const StyledPromptShell = styled.div`
  position: relative;
  width: 100%;
`;

const StyledModeTabs = styled.div`
  bottom: 100%;
  display: flex;
  gap: ${themeCssVariables.spacing[1]};
  left: 50%;
  margin-bottom: -14px;
  position: absolute;
  transform: translateX(-50%);
  z-index: 2;
`;

const StyledModeTab = styled.button<{ active: boolean }>`
  align-items: center;
  background: ${({ active }) =>
    active
      ? themeCssVariables.background.primary
      : themeCssVariables.background.transparent.medium};
  border: 1px solid
    ${({ active }) =>
      active
        ? themeCssVariables.color.blue
        : themeCssVariables.border.color.medium};
  border-radius: 999px;
  box-shadow: ${({ active }) =>
    active ? `0 0 0 1px ${themeCssVariables.color.blue}` : 'none'};
  color: ${themeCssVariables.font.color.primary};
  cursor: pointer;
  display: flex;
  font-size: ${themeCssVariables.font.size.sm};
  gap: ${themeCssVariables.spacing[1]};
  padding: ${themeCssVariables.spacing[1]} ${themeCssVariables.spacing[2]};
`;

const StyledPromptBox = styled.div`
  border-radius: 24px;
  background: linear-gradient(
    145deg,
    #3b5bff 0%,
    #7a4cff 28%,
    #d24bff 55%,
    #ff4f6a 78%,
    #ffb04a 100%
  );
  box-shadow:
    0 0 0 1px rgba(255, 255, 255, 0.06) inset,
    0 12px 48px rgba(80, 60, 200, 0.35);
  padding: 2px;
  width: 100%;
`;

const StyledPromptInner = styled.div`
  background: ${themeCssVariables.background.secondary};
  border-radius: 22px;
  display: flex;
  flex-direction: column;
  min-height: 168px;
  padding: ${themeCssVariables.spacing[3]};
`;

const StyledTextArea = styled.textarea`
  background: transparent;
  border: none;
  color: ${themeCssVariables.font.color.primary};
  flex: 1;
  font-size: ${themeCssVariables.font.size.md};
  line-height: 1.45;
  min-height: 96px;
  outline: none;
  resize: none;
  width: 100%;

  &::placeholder {
    color: ${themeCssVariables.font.color.light};
  }
`;

const StyledPromptFooter = styled.div`
  align-items: center;
  display: flex;
  justify-content: space-between;
  margin-top: ${themeCssVariables.spacing[2]};
`;

const StyledIconCircleButton = styled.button<{ accent?: 'primary' }>`
  align-items: center;
  background: ${({ accent }) =>
    accent === 'primary'
      ? themeCssVariables.background.primary
      : themeCssVariables.background.transparent.medium};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: 999px;
  color: ${themeCssVariables.font.color.primary};
  cursor: pointer;
  display: flex;
  height: 36px;
  justify-content: center;
  width: 36px;

  &:disabled {
    cursor: not-allowed;
    opacity: 0.45;
  }
`;

const StyledHint = styled.div`
  color: ${themeCssVariables.font.color.light};
  flex: 1;
  font-size: ${themeCssVariables.font.size.xs};
  padding: 0 ${themeCssVariables.spacing[2]};
  text-align: center;
`;

const StyledCreateRow = styled.div`
  display: flex;
  justify-content: center;
  margin-top: ${themeCssVariables.spacing[2]};
`;

const StyledCardsGrid = styled.div`
  display: grid;
  gap: ${themeCssVariables.spacing[2]};
  grid-template-columns: repeat(2, minmax(0, 1fr));
  margin-top: ${themeCssVariables.spacing[2]};
  width: 100%;

  @media (min-width: 720px) {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
`;

const StyledSuggestCard = styled.button`
  background: ${themeCssVariables.background.secondary};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.md};
  color: ${themeCssVariables.font.color.primary};
  cursor: pointer;
  padding: ${themeCssVariables.spacing[2]};
  text-align: left;
  transition: border-color 0.15s ease;

  &:hover {
    border-color: ${themeCssVariables.color.blue};
  }
`;

const StyledSuggestTitle = styled.div`
  font-size: ${themeCssVariables.font.size.sm};
  font-weight: ${themeCssVariables.font.weight.medium};
  margin-bottom: ${themeCssVariables.spacing['0.5']};
`;

const StyledSuggestSub = styled.div`
  color: ${themeCssVariables.font.color.light};
  font-size: ${themeCssVariables.font.size.xs};
  line-height: 1.35;
`;

const StyledPillsRow = styled.div`
  display: flex;
  gap: ${themeCssVariables.spacing[1]};
  margin-top: ${themeCssVariables.spacing[3]};
  overflow-x: auto;
  padding-bottom: ${themeCssVariables.spacing[1]};
  width: 100%;
`;

const StyledPill = styled.span`
  background: ${themeCssVariables.background.tertiary};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: 999px;
  color: ${themeCssVariables.font.color.secondary};
  flex-shrink: 0;
  font-size: ${themeCssVariables.font.size.xs};
  padding: ${themeCssVariables.spacing[1]} ${themeCssVariables.spacing[2]};
`;

const StyledChatArea = styled.div`
  border-top: 1px solid ${themeCssVariables.border.color.medium};
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  margin-top: ${themeCssVariables.spacing[2]};
  min-height: 0;
`;

const extractUserTextFromMessages = (messages: ExtendedUIMessage[]): string => {
  const chunks: string[] = [];

  for (const message of messages) {
    if (message.role !== 'user') {
      continue;
    }

    const parts = message.parts ?? [];

    if (parts.length > 0) {
      for (const part of parts) {
        if (part.type === 'text' && 'text' in part) {
          chunks.push(String((part as { text: string }).text));
        }
      }
    } else {
      const legacy = message as ExtendedUIMessage & { content?: unknown };

      if (typeof legacy.content === 'string' && legacy.content.trim() !== '') {
        chunks.push(legacy.content);
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

const CATEGORY_PILLS = [
  'Apps',
  'Projects',
  'Personal',
  'Tasks',
  'Exec',
  'Scheduling',
  'Software',
  'Meetings',
  'Research',
  'Writing',
] as const;

export const SuperagentsPage = () => {
  const { t } = useLingui();
  const { switchToNewChat } = useSwitchToNewAIChat();
  const { enqueueErrorSnackBar, enqueueSuccessSnackBar } = useSnackBar();
  const setAgentChatInput = useSetAtomState(agentChatInputState);
  const [agentChatDraftsByThreadId, setAgentChatDraftsByThreadId] =
    useAtomState(agentChatDraftsByThreadIdState);
  const [agentChatInput] = useAtomState(agentChatInputState);
  const currentAIChatThread = useAtomStateValue(currentAIChatThreadState);
  const displayedThread = useAtomStateValue(agentChatDisplayedThreadState);
  const agentChatIsLoading = useAtomStateValue(agentChatIsLoadingState);
  const [createAgent] = useMutation(CreateOneAgentDocument);

  const [mode, setMode] = useState<'ask' | 'agents'>('agents');
  const [isCreating, setIsCreating] = useState(false);

  const draftKey = currentAIChatThread ?? AGENT_CHAT_NEW_THREAD_DRAFT_KEY;

  const threadIdForMessages = useMemo(() => {
    if (
      isDefined(currentAIChatThread) &&
      currentAIChatThread !== AGENT_CHAT_NEW_THREAD_DRAFT_KEY
    ) {
      return currentAIChatThread;
    }

    if (displayedThread && displayedThread !== '') {
      return displayedThread;
    }

    return AGENT_CHAT_NEW_THREAD_DRAFT_KEY;
  }, [currentAIChatThread, displayedThread]);

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

  const canSend =
    heroText.trim().length > 0 && !agentChatIsLoading && !isCreating;

  const handleSend = () => {
    if (!canSend) {
      return;
    }

    dispatchAgentChatSendMessageEvent();
  };

  const handleTextareaKeyDown = (
    event: KeyboardEvent<HTMLTextAreaElement>,
  ) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  const handleCreateSuperagent = async () => {
    const promptSource =
      conversationPrompt.length > 0
        ? conversationPrompt
        : heroText.trim();

    if (!promptSource) {
      enqueueErrorSnackBar({
        message: t`Type a message and send it to the AI first, or describe your superagent in the box above.`,
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
        `${mentionToken} You are live. Introduce yourself briefly and ask what I want to do first.`,
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

  const suggestions = [
    {
      title: t`Support Triage`,
      sub: t`Categorizes support tickets`,
      prefill: t`Categorize and triage support tickets by urgency and topic`,
    },
    {
      title: t`Refund Policy`,
      sub: t`Applies refund guidelines`,
      prefill: t`Apply our refund policy consistently and draft customer replies`,
    },
    {
      title: t`Sensitive Content`,
      sub: t`Flags inappropriate messages`,
      prefill: t`Flag sensitive or inappropriate messages and escalate when needed`,
    },
    {
      title: t`Account Troubleshooter`,
      sub: t`Diagnoses access issues`,
      prefill: t`Diagnose account and login access issues step by step`,
    },
  ];

  return (
    <StyledPage>
      <StyledShell>
        <StyledStartOver type="button" onClick={handleStartFromScratch}>
          {t`Start from scratch`}
        </StyledStartOver>

        <StyledHero>
          <StyledBrandRow>
            <StyledBrandMark>
              <IconSparkles size={22} color="#fff" />
            </StyledBrandMark>
            <StyledHeroTitle>{t`Super Agents`}</StyledHeroTitle>
          </StyledBrandRow>

          <StyledPromptShell>
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
                  onChange={(event) => syncDraft(event.target.value)}
                  onKeyDown={handleTextareaKeyDown}
                />
                <StyledPromptFooter>
                  <StyledIconCircleButton
                    type="button"
                    title={t`Add`}
                    disabled
                  >
                    <IconPlus size={18} />
                  </StyledIconCircleButton>
                  <StyledHint>
                    {mode === 'agents'
                      ? t`Chat with the AI below, then tap Create when you are ready`
                      : t`Enter to send · Shift+Enter for new line`}
                  </StyledHint>
                  <StyledIconCircleButton
                    accent="primary"
                    type="button"
                    title={t`Send`}
                    onClick={handleSend}
                    disabled={!canSend}
                  >
                    <IconArrowUp size={18} />
                  </StyledIconCircleButton>
                </StyledPromptFooter>
              </StyledPromptInner>
            </StyledPromptBox>
          </StyledPromptShell>

          {mode === 'agents' && (
            <StyledCreateRow>
              <Button
                title={
                  isCreating
                    ? t`Creating...`
                    : t`Create superagent from conversation`
                }
                onClick={handleCreateSuperagent}
                disabled={isCreating || agentChatIsLoading}
              />
            </StyledCreateRow>
          )}

          {mode === 'agents' && (
            <StyledCardsGrid>
              {suggestions.map((s) => (
                <StyledSuggestCard
                  key={s.title}
                  type="button"
                  onClick={() => syncDraft(s.prefill)}
                >
                  <StyledSuggestTitle>{s.title}</StyledSuggestTitle>
                  <StyledSuggestSub>{s.sub}</StyledSuggestSub>
                </StyledSuggestCard>
              ))}
            </StyledCardsGrid>
          )}

          {mode === 'agents' && (
            <StyledPillsRow>
              {CATEGORY_PILLS.map((pill) => (
                <StyledPill key={pill}>{pill}</StyledPill>
              ))}
            </StyledPillsRow>
          )}
        </StyledHero>

        <StyledChatArea>
          <AIChatTab hideComposer />
        </StyledChatArea>
      </StyledShell>
    </StyledPage>
  );
};
