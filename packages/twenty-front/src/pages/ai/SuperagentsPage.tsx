/* oxlint-disable twenty/no-hardcoded-colors */
import { styled } from '@linaria/react';
import { useLingui } from '@lingui/react/macro';
import { type ErrorLike } from '@apollo/client';
import { useMutation } from '@apollo/client/react';
import { type KeyboardEvent, useCallback, useMemo, useState } from 'react';
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
import {
  CreateOneAgentDocument,
  type CreateAgentInput,
} from '~/generated-metadata/graphql';
import { pickSuperagentLook } from '~/pages/settings/ai/constants/superagentLooks';
import { computeMetadataNameFromLabel } from '~/pages/settings/data-model/utils/computeMetadataNameFromLabel';
import {
  IconArrowRight,
  IconPlus,
  IconSettingsAutomation,
  IconSparkles,
} from 'twenty-ui/display';
import { turnIntoEmptyStringIfWhitespacesOnly } from '~/utils/string/turnIntoEmptyStringIfWhitespacesOnly';

/* Reference palette (Tailwind-inspired) */
const C = {
  page: '#131315',
  surface: '#18181B',
  surface2: '#1E1E22',
  surface3: '#27272A',
  surface4: '#111318',
  border: '#27272A',
  borderMuted: '#374151',
  text: '#ffffff',
  textMuted: '#9ca3af',
  textSoft: '#6b7280',
  textTitle: '#f3f4f6',
  tabActive: '#1A56DB',
  green: '#16a34a',
  red: '#ef4444',
  pink: '#ec4899',
  yellow: '#ca8a04',
  pillActiveBg: '#e5e7eb',
  pillActiveText: '#111827',
} as const;

const StyledPage = styled.div`
  background: ${C.page};
  color: ${C.text};
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  font-family:
    ui-sans-serif,
    system-ui,
    -apple-system,
    'Segoe UI',
    Roboto,
    sans-serif;
  min-height: 0;
  min-height: 100%;
  overflow: auto;
  position: relative;

  &::before {
    background: radial-gradient(
      circle at 50% -20%,
      rgba(59, 130, 246, 0.22),
      transparent 48%
    );
    content: '';
    inset: 0;
    pointer-events: none;
    position: absolute;
  }
`;

const StyledStartOver = styled.button`
  background: transparent;
  border: 1px solid ${C.borderMuted};
  border-radius: 999px;
  color: #d1d5db;
  cursor: pointer;
  font-size: 12px;
  padding: 6px 16px;
  position: absolute;
  right: 24px;
  top: 24px;
  transition: background 0.15s ease;
  z-index: 2;

  &:hover {
    background: #1f2937;
  }
`;

const StyledMain = styled.div`
  align-items: center;
  display: flex;
  flex: 1;
  flex-direction: column;
  margin: 0 auto;
  max-width: 1120px;
  min-height: 0;
  padding: 72px 32px 28px;
  position: relative;
  width: 100%;
  z-index: 1;
`;

const StyledBrandRow = styled.div`
  align-items: center;
  display: flex;
  gap: 14px;
  margin-bottom: 18px;
`;

const StyledLogoSplit = styled.div`
  border-radius: 999px;
  display: flex;
  height: 20px;
  overflow: hidden;
  width: 40px;
`;

const StyledLogoHalf = styled.div<{ side: 'l' | 'r' }>`
  background: ${({ side }) => (side === 'l' ? C.red : '#3b82f6')};
  height: 100%;
  width: 50%;
  ${({ side }) =>
    side === 'l'
      ? 'border-radius: 9999px 0 0 9999px;'
      : 'border-radius: 0 9999px 9999px 0;'}
`;

const StyledHeroTitle = styled.h1`
  align-items: flex-start;
  color: ${C.textTitle};
  display: flex;
  font-size: 44px;
  font-weight: 500;
  gap: 4px;
  letter-spacing: -0.025em;
  line-height: 1.1;
  margin: 0;
`;

const StyledTm = styled.span`
  color: ${C.textSoft};
  font-size: 12px;
  margin-top: 4px;
`;

const StyledTabsRow = styled.div`
  background: ${C.surface2};
  border: 1px solid rgba(255, 255, 255, 0.04);
  border-radius: 999px;
  display: flex;
  gap: 0;
  margin-bottom: 24px;
  padding: 4px;
  position: relative;
  z-index: 10;
`;

const StyledModeTab = styled.button<{ active: boolean }>`
  align-items: center;
  background: ${({ active }) => (active ? C.tabActive : 'transparent')};
  border: none;
  border-radius: 999px;
  box-shadow: ${({ active }) =>
    active ? '0 1px 2px rgba(0, 0, 0, 0.2)' : 'none'};
  color: ${({ active }) => (active ? '#ffffff' : C.textMuted)};
  cursor: pointer;
  display: flex;
  font-size: 14px;
  gap: 8px;
  padding: 6px 20px;
  transition:
    color 0.15s ease,
    background 0.15s ease;

  &:hover {
    color: ${({ active }) => (active ? '#ffffff' : '#e5e7eb')};
  }
`;

const StyledPromptGradient = styled.div`
  background: linear-gradient(
    90deg,
    #3b82f6 0%,
    #8b5cf6 50%,
    #f97316 100%
  );
  border-radius: 22px;
  box-shadow:
    0 22px 50px rgba(15, 20, 34, 0.45),
    0 0 46px rgba(139, 92, 246, 0.2);
  margin-bottom: 14px;
  margin-top: -2px;
  padding: 2px;
  width: 100%;
  z-index: 0;
`;

const StyledPromptInner = styled.div`
  background: linear-gradient(180deg, #181b20 0%, #14161c 100%);
  border-radius: 20px;
  display: flex;
  flex-direction: column;
  height: 228px;
  padding: 16px 16px 12px;
  padding-top: 32px;
  position: relative;
`;

const StyledTextArea = styled.textarea`
  background: transparent;
  border: none;
  color: #e5e7eb;
  flex: 1;
  font-family:
    ui-monospace,
    SFMono-Regular,
    Menlo,
    Monaco,
    Consolas,
    monospace;
  font-size: 15px;
  line-height: 1.7;
  outline: none;
  resize: none;
  width: 100%;

  &::placeholder {
    color: #6b7280;
  }
`;

const StyledPromptFooter = styled.div`
  align-items: center;
  display: flex;
  justify-content: space-between;
  margin-top: auto;
  padding: 4px 4px 0;
  width: 100%;
`;

const StyledRoundIconBtn = styled.button`
  align-items: center;
  background: ${C.surface3};
  border: none;
  border-radius: 999px;
  color: #9ca3af;
  cursor: pointer;
  display: flex;
  flex-shrink: 0;
  height: 32px;
  justify-content: center;
  transition:
    background 0.15s ease,
    color 0.15s ease;
  width: 32px;

  &:hover:not(:disabled) {
    background: #3f3f46;
    color: #ffffff;
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.45;
  }
`;

const StyledHint = styled.span`
  color: ${C.textSoft};
  flex: 1;
  font-family:
    ui-monospace,
    SFMono-Regular,
    Menlo,
    Monaco,
    Consolas,
    monospace;
  font-size: 12px;
  padding: 0 12px;
  text-align: center;
`;

const StyledCreateBtn = styled.button`
  background: linear-gradient(180deg, #f8fafc 0%, #e2e8f0 100%);
  border: none;
  border-radius: 10px;
  color: #111827;
  cursor: pointer;
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 38px;
  padding: 10px 22px;
  transition:
    transform 0.15s ease,
    box-shadow 0.15s ease;

  &:hover:not(:disabled) {
    box-shadow: 0 8px 26px rgba(148, 163, 184, 0.26);
    transform: translateY(-1px);
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }
`;

const StyledCardsGrid = styled.div`
  display: grid;
  gap: 16px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  margin-bottom: 26px;
  width: 100%;

  @media (min-width: 900px) {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
`;

const StyledSuggestCard = styled.button`
  background: linear-gradient(180deg, #161922 0%, #13151c 100%);
  border: 1px solid rgba(255, 255, 255, 0.07);
  border-radius: 12px;
  color: ${C.text};
  cursor: pointer;
  display: flex;
  flex-direction: column;
  padding: 16px;
  text-align: left;
  transition:
    background 0.15s ease,
    transform 0.15s ease,
    border-color 0.15s ease;

  &:hover {
    background: #1a1f2a;
    border-color: rgba(148, 163, 184, 0.5);
    transform: translateY(-2px);
  }
`;

const StyledCardDot = styled.div<{ color: string }>`
  background: ${({ color }) => color};
  border: 2px solid ${C.surface};
  border-radius: 999px;
  height: 24px;
  margin-bottom: 12px;
  overflow: hidden;
  width: 24px;
`;

const StyledCardDotInner = styled.div`
  background: rgba(255, 255, 255, 0.2);
  height: 100%;
  width: 100%;
`;

const StyledSuggestTitle = styled.h3`
  color: #e5e7eb;
  font-size: 14px;
  font-weight: 500;
  margin: 0 0 4px;
`;

const StyledSuggestSub = styled.p`
  color: ${C.textSoft};
  font-size: 12px;
  line-height: 1.35;
  margin: 0;
`;

const StyledTagsWrap = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  justify-content: center;
  margin-bottom: 26px;
  max-width: 896px;
  padding: 0 16px;
  width: 100%;
`;

const StyledTag = styled.button<{ active: boolean }>`
  background: ${({ active }) => (active ? C.pillActiveBg : 'transparent')};
  border: ${({ active }) =>
    active ? 'none' : `1px solid ${C.borderMuted}`};
  border-radius: 999px;
  color: ${({ active }) => (active ? C.pillActiveText : C.textMuted)};
  cursor: pointer;
  font-size: 12px;
  font-weight: ${({ active }) => (active ? 500 : 400)};
  padding: 6px 14px;
  transition:
    border-color 0.15s ease,
    color 0.15s ease;

  &:hover {
    border-color: #6b7280;
    color: #e5e7eb;
  }
`;

const StyledChatArea = styled.div`
  background: ${C.surface4};
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 14px;
  box-shadow: 0 24px 40px rgba(3, 7, 18, 0.36);
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  margin-top: 6px;
  min-height: 220px;
  overflow: hidden;
  padding-top: 8px;
  width: 100%;
`;

const StyledChatPlaceholder = styled.div`
  align-items: center;
  color: ${C.textSoft};
  display: flex;
  font-size: 13px;
  height: 220px;
  justify-content: center;
  text-align: center;
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

const TAG_LABELS = [
  'Apps',
  'Projects',
  'Personal',
  'Certified',
  'Tasks',
  'Exec',
  'Scheduling',
  'Software',
  'Meetings',
  'Intelligence',
  'Research',
  'Updates',
  'Writing',
  'C-Suite',
  'Teams',
  'Design',
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
  const agentChatDisplayedThread = useAtomStateValue(
    agentChatDisplayedThreadState,
  );
  const agentChatIsLoading = useAtomStateValue(agentChatIsLoadingState);
  const [createAgent] = useMutation(CreateOneAgentDocument);

  const [mode, setMode] = useState<'ask' | 'agents'>('agents');
  const [isCreating, setIsCreating] = useState(false);
  const [activeTag, setActiveTag] = useState<string>('Apps');

  const draftKey = currentAIChatThread ?? AGENT_CHAT_NEW_THREAD_DRAFT_KEY;

  const threadIdForMessages = useMemo(() => {
    if (
      isDefined(currentAIChatThread) &&
      currentAIChatThread !== AGENT_CHAT_NEW_THREAD_DRAFT_KEY
    ) {
      return currentAIChatThread;
    }

    if (
      agentChatDisplayedThread &&
      agentChatDisplayedThread !== ''
    ) {
      return agentChatDisplayedThread;
    }

    return AGENT_CHAT_NEW_THREAD_DRAFT_KEY;
  }, [currentAIChatThread, agentChatDisplayedThread]);

  const agentChatMessages = useAtomComponentFamilyStateValue(
    agentChatMessagesComponentFamilyState,
    { threadId: threadIdForMessages },
  );

  const conversationPrompt = useMemo(
    () => extractUserTextFromMessages(agentChatMessages),
    [agentChatMessages],
  );
  const hasConversation = agentChatMessages.length > 0;

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
        apolloError: error as ErrorLike,
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleStartFromScratch = () => {
    setMode('agents');
    switchToNewChat();
  };

  const suggestions: {
    title: string;
    sub: string;
    prefill: string;
    color: string;
  }[] = [
    {
      title: t`Support Triage`,
      sub: t`Categorizes support tickets`,
      prefill: t`Categorize and triage support tickets by urgency and topic`,
      color: C.green,
    },
    {
      title: t`Refund Policy`,
      sub: t`Applies refund guidelines`,
      prefill: t`Apply our refund policy consistently and draft customer replies`,
      color: C.red,
    },
    {
      title: t`Sensitive Content`,
      sub: t`Flags inappropriate messages`,
      prefill: t`Flag sensitive or inappropriate messages and escalate when needed`,
      color: C.pink,
    },
    {
      title: t`Account Troubleshooter`,
      sub: t`Diagnoses access issues`,
      prefill: t`Diagnose account and login access issues step by step`,
      color: C.yellow,
    },
  ];

  return (
    <StyledPage>
      <StyledStartOver type="button" onClick={handleStartFromScratch}>
        {t`Start from scratch`}
      </StyledStartOver>

      <StyledMain>
        <StyledBrandRow>
          <StyledLogoSplit>
            <StyledLogoHalf side="l" />
            <StyledLogoHalf side="r" />
          </StyledLogoSplit>
          <StyledHeroTitle>
            {t`Super Agents`}
            <StyledTm>TM</StyledTm>
          </StyledHeroTitle>
        </StyledBrandRow>

        <StyledTabsRow>
          <StyledModeTab
            active={mode === 'ask'}
            type="button"
            onClick={() => setMode('ask')}
          >
            <IconSparkles size={16} />
            {t`Ask`}
          </StyledModeTab>
          <StyledModeTab
            active={mode === 'agents'}
            type="button"
            onClick={() => setMode('agents')}
          >
            <IconSettingsAutomation size={16} />
            {t`Agents`}
          </StyledModeTab>
        </StyledTabsRow>

        <StyledPromptGradient>
          <StyledPromptInner>
            <StyledTextArea
              spellCheck={false}
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
              <StyledRoundIconBtn type="button" title={t`Add`} disabled>
                <IconPlus size={16} />
              </StyledRoundIconBtn>
              <StyledHint>
                {mode === 'agents'
                  ? t`Chat with the AI below, then tap Create when you are ready`
                  : t`Enter to send · Shift+Enter for new line`}
              </StyledHint>
              <StyledRoundIconBtn
                type="button"
                title={t`Send`}
                onClick={handleSend}
                disabled={!canSend}
              >
                <IconArrowRight size={16} />
              </StyledRoundIconBtn>
            </StyledPromptFooter>
          </StyledPromptInner>
        </StyledPromptGradient>

        {mode === 'agents' && (
          <StyledCreateBtn
            type="button"
            onClick={handleCreateSuperagent}
            disabled={isCreating || agentChatIsLoading}
          >
            {isCreating
              ? t`Creating...`
              : t`Create superagent from conversation`}
          </StyledCreateBtn>
        )}

        {mode === 'agents' && (
          <StyledCardsGrid>
            {suggestions.map((s) => (
              <StyledSuggestCard
                key={s.title}
                type="button"
                onClick={() => syncDraft(s.prefill)}
              >
                <StyledCardDot color={s.color}>
                  <StyledCardDotInner />
                </StyledCardDot>
                <StyledSuggestTitle>{s.title}</StyledSuggestTitle>
                <StyledSuggestSub>{s.sub}</StyledSuggestSub>
              </StyledSuggestCard>
            ))}
          </StyledCardsGrid>
        )}

        {mode === 'agents' && (
          <StyledTagsWrap>
            {TAG_LABELS.map((tag) => (
              <StyledTag
                key={tag}
                active={activeTag === tag}
                type="button"
                onClick={() => setActiveTag(tag)}
              >
                {tag}
              </StyledTag>
            ))}
          </StyledTagsWrap>
        )}

        <StyledChatArea>
          {mode === 'ask' || hasConversation ? (
            <AIChatTab hideComposer />
          ) : (
            <StyledChatPlaceholder>
              {t`Send your first message to start the conversation preview.`}
            </StyledChatPlaceholder>
          )}
        </StyledChatArea>
      </StyledMain>
    </StyledPage>
  );
};
