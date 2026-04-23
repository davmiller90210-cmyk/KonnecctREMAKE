/* eslint-disable twenty/no-state-useref -- composer needs stable refs for textarea/debounce across async events */
import { styled } from '@linaria/react';
import { useLingui } from '@lingui/react/macro';
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
} from 'react';
import { playChatSendSound } from '@/chat/constants/chatSendSoundStorage';
import { ChatMentionPopover } from '@/chat/components/ChatMentionPopover';
import {
  ChatSlashCommandPopover,
  type ChatSlashCommandItem,
} from '@/chat/components/ChatSlashCommandPopover';
import { ChatGifPickerPopover } from '@/chat/components/ChatGifPickerPopover';
import { ChatComposerBar } from '@/chat/ui/composer/ChatComposerBar';
import { useCrmMentionSearch } from '@/chat/hooks/useCrmMentionSearch';
import { type MentionItem } from '@/chat/types/MentionItem';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { Button, LightIconButton } from 'twenty-ui/input';
import { IconPaperclip, IconPhoto, IconSend } from 'twenty-ui/display';
import { themeCssVariables } from 'twenty-ui/theme-constants';

const StyledContainer = styled.div`
  flex-shrink: 0;
  position: relative;
`;

const StyledRow = styled.div`
  align-items: flex-end;
  display: flex;
  gap: ${themeCssVariables.spacing[2]};
`;

const StyledTextarea = styled.textarea`
  background: ${themeCssVariables.background.transparent.lighter};
  border: 1px solid ${themeCssVariables.border.color.light};
  border-radius: ${themeCssVariables.border.radius.sm};
  color: ${themeCssVariables.font.color.primary};
  font-family: ${themeCssVariables.font.family};
  font-size: ${themeCssVariables.font.size.md};
  min-height: 40px;
  max-height: 160px;
  outline: none;
  padding: ${themeCssVariables.spacing[2]} ${themeCssVariables.spacing[3]};
  resize: none;
  width: 100%;

  &:focus {
    border-color: ${themeCssVariables.color.blue};
  }

  &::placeholder {
    color: ${themeCssVariables.font.color.tertiary};
  }

  &:disabled {
    opacity: 0.6;
  }
`;

const StyledHiddenFileInput = styled.input`
  display: none;
`;

const CHAT_COMPOSER_DRAFT_PREFIX = 'twenty-chat-composer-draft:';

type ChatComposerProps = {
  disabled?: boolean;
  placeholder?: string;
  onSend: (text: string) => Promise<void> | void;
  onSendFile?: (file: File) => Promise<void> | void;
  onTypingStart?: () => void;
  onTypingEnd?: () => void;
  /** Shown name for `/me` (workspace member display name). */
  viewerDisplayName?: string;
  /** Optional: collapse chat details / side panel (UI-only `/collapse`). */
  onCollapseThreadUi?: () => void;
  /** Current channel members for @user mentions (Sendbird user ids). */
  mentionUserCandidates?: { userId: string; label: string }[];
  /** Bearer token for server-proxied Giphy GIF picker (native chat). */
  gifPickerToken?: string | null;
  /** When set, draft text is restored and persisted in `localStorage` for this conversation. */
  draftStorageKey?: string | null;
};

export type ChatComposerHandle = {
  focusMessageInput: () => void;
  /** Apply draft text from URL/deep-link (does not clear mention/slash state). */
  setMessageDraft: (text: string) => void;
};

const MENTION_DEBOUNCE_MS = 150;
const MENTION_REGEX = /@([\w\s]*)$/;
const SLASH_COMMAND_REGEX = /(?:^|\s)\/([\w-]*)$/;

export const ChatComposer = forwardRef<ChatComposerHandle, ChatComposerProps>(
  function ChatComposer(
    {
      disabled,
      placeholder,
      onSend,
      onSendFile,
      onTypingStart,
      onTypingEnd,
      viewerDisplayName,
      onCollapseThreadUi,
      mentionUserCandidates = [],
      gifPickerToken,
      draftStorageKey = null,
    },
    ref,
  ) {
  const { t } = useLingui();
  const { enqueueErrorSnackBar, enqueueSuccessSnackBar } = useSnackBar();
  const { searchMentionRecords } = useCrmMentionSearch();

  const [value, setValue] = useState('');
  const [isSending, setIsSending] = useState(false);
  const draftPersistenceKeyRef = useRef<string | null>(null);
  const draftSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionItems, setMentionItems] = useState<MentionItem[]>([]);
  const [mentionActiveIndex, setMentionActiveIndex] = useState(0);
  const [mentionStart, setMentionStart] = useState<number | null>(null);

  const [slashOpen, setSlashOpen] = useState(false);
  const [slashItems, setSlashItems] = useState<ChatSlashCommandItem[]>([]);
  const [slashActiveIndex, setSlashActiveIndex] = useState(0);
  const [slashStart, setSlashStart] = useState<number | null>(null);

  const [gifPickerOpen, setGifPickerOpen] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const mentionDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);

  useEffect(() => {
    return () => {
      if (mentionDebounceRef.current) clearTimeout(mentionDebounceRef.current);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (draftStorageKey === draftPersistenceKeyRef.current) {
      return;
    }
    draftPersistenceKeyRef.current = draftStorageKey;
    if (!draftStorageKey) {
      setValue('');
      return;
    }
    try {
      const raw = localStorage.getItem(
        CHAT_COMPOSER_DRAFT_PREFIX + draftStorageKey,
      );
      setValue(typeof raw === 'string' ? raw : '');
    } catch {
      setValue('');
    }
  }, [draftStorageKey]);

  useEffect(() => {
    if (!draftStorageKey) {
      return;
    }
    if (draftSaveTimerRef.current) {
      clearTimeout(draftSaveTimerRef.current);
    }
    draftSaveTimerRef.current = setTimeout(() => {
      try {
        if (value.trim()) {
          localStorage.setItem(
            CHAT_COMPOSER_DRAFT_PREFIX + draftStorageKey,
            value,
          );
        } else {
          localStorage.removeItem(
            CHAT_COMPOSER_DRAFT_PREFIX + draftStorageKey,
          );
        }
      } catch {
        // quota / private mode
      }
    }, 450);
    return () => {
      if (draftSaveTimerRef.current) {
        clearTimeout(draftSaveTimerRef.current);
      }
    };
  }, [value, draftStorageKey]);

  const autoResize = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, 160)}px`;
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      focusMessageInput: () => {
        textareaRef.current?.focus();
      },
      setMessageDraft: (text: string) => {
        setValue(text);
        requestAnimationFrame(() => {
          autoResize();
        });
      },
    }),
    [autoResize],
  );

  useEffect(() => {
    autoResize();
  }, [value, autoResize]);

  const fireTypingStart = () => {
    if (!onTypingStart) return;
    if (!isTypingRef.current) {
      isTypingRef.current = true;
      onTypingStart();
    }
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      isTypingRef.current = false;
      onTypingEnd?.();
    }, 3000);
  };

  const resetMention = () => {
    setMentionOpen(false);
    setMentionItems([]);
    setMentionStart(null);
    setMentionActiveIndex(0);
  };

  const resetSlash = () => {
    setSlashOpen(false);
    setSlashItems([]);
    setSlashStart(null);
    setSlashActiveIndex(0);
  };

  const insertGifMarkdown = useCallback(
    (imageUrl: string) => {
      const snippet = `![gif](${imageUrl})`;
      const ta = textareaRef.current;
      if (!ta) {
        setValue((previous) =>
          previous.length > 0 ? `${previous}\n${snippet}` : snippet,
        );
        return;
      }
      const caret = ta.selectionStart ?? value.length;
      const end = ta.selectionEnd ?? value.length;
      const before = value.slice(0, caret);
      const after = value.slice(end);
      const needsLeadingNewline =
        before.length > 0 && !before.endsWith('\n') && !before.endsWith(' ');
      const insertion = `${needsLeadingNewline ? '\n' : ''}${snippet}`;
      const nextValue = before + insertion + after;
      setValue(nextValue);
      const pos = (before + insertion).length;
      requestAnimationFrame(() => {
        const el = textareaRef.current;
        if (!el) {
          return;
        }
        el.focus();
        el.setSelectionRange(pos, pos);
      });
    },
    [value],
  );

  const allSlashCommands = useMemo<ChatSlashCommandItem[]>(
    () => [
      {
        id: 'me',
        label: '/me',
        description: t`Insert your name as an action line`,
      },
      {
        id: 'shrug',
        label: '/shrug',
        description: t`Append a shrug`,
      },
      {
        id: 'remind',
        label: '/remind',
        description: t`Insert a reminder stub (CRM task link coming soon)`,
      },
      {
        id: 'here',
        label: '/here',
        description: t`Insert @here for visibility`,
      },
      {
        id: 'collapse',
        label: '/collapse',
        description: t`Hide the details panel`,
      },
    ],
    [t],
  );

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    const next = e.target.value;
    setValue(next);
    fireTypingStart();

    const caret = e.target.selectionStart ?? next.length;
    const before = next.slice(0, caret);
    const slashMatch = SLASH_COMMAND_REGEX.exec(before);

    if (slashMatch) {
      setGifPickerOpen(false);
      resetMention();
      const query = slashMatch[1].toLowerCase();
      const start = caret - slashMatch[0].length;
      setSlashStart(start);
      setSlashOpen(true);
      setSlashActiveIndex(0);
      const filtered = allSlashCommands.filter(
        (cmd) =>
          query.length === 0 ||
          cmd.id.startsWith(query) ||
          cmd.label.toLowerCase().includes(query),
      );
      setSlashItems(filtered);
      return;
    }

    resetSlash();

    const match = MENTION_REGEX.exec(before);

    if (!match) {
      resetMention();
      return;
    }

    setGifPickerOpen(false);
    const query = match[1];
    setMentionStart(caret - match[0].length);
    setMentionOpen(true);
    setMentionActiveIndex(0);

    if (mentionDebounceRef.current) clearTimeout(mentionDebounceRef.current);
    mentionDebounceRef.current = setTimeout(() => {
      void (async () => {
        const results = await searchMentionRecords(query);
        const base: MentionItem[] = results.slice(0, 20).map((r) => {
          if (r.mentionType === 'agent') {
            return { kind: 'agent', label: r.label, recordId: r.recordId };
          }
          return {
            kind: 'crm',
            label: r.label,
            objectNameSingular: r.objectNameSingular,
            objectLabelSingular: r.objectLabelSingular,
            recordId: r.recordId,
            href: `twenty://record/${r.objectNameSingular}/${r.recordId}`,
            imageUrl: r.imageUrl?.trim() || undefined,
          };
        });

        const queryLower = query.toLowerCase();
        const showKonnecctAI =
          queryLower.length === 0 ||
          'konnecctai'.startsWith(queryLower) ||
          'konnecct'.startsWith(queryLower) ||
          'ai'.startsWith(queryLower);

        const withAi: MentionItem[] = showKonnecctAI
          ? [{ kind: 'konnecctai', label: 'KonnecctAI' }]
          : [];

        const qLower = queryLower;
        const memberItems: MentionItem[] = mentionUserCandidates
          .filter(
            (m) =>
              qLower.length === 0 ||
              m.label.toLowerCase().includes(qLower) ||
              m.userId.toLowerCase().includes(qLower),
          )
          .slice(0, 15)
          .map((m) => ({
            kind: 'user' as const,
            userId: m.userId,
            label: m.label,
          }));

        setMentionItems([...withAi, ...memberItems, ...base]);
      })();
    }, MENTION_DEBOUNCE_MS);
  };

  const applySlashCommand = (item: ChatSlashCommandItem) => {
    if (slashStart === null || !textareaRef.current) {
      return;
    }
    const caret = textareaRef.current.selectionStart ?? value.length;
    const before = value.slice(0, slashStart);
    const after = value.slice(caret);
    const name =
      viewerDisplayName?.trim() ||
      t`You`;

    let insertion = '';
    if (item.id === 'me') {
      insertion = `*${name}* `;
    } else if (item.id === 'shrug') {
      insertion = `¯\\_(ツ)_/¯ `;
    } else if (item.id === 'remind') {
      insertion = t`Reminder: `;
    } else if (item.id === 'here') {
      insertion = '@here ';
    } else if (item.id === 'collapse') {
      onCollapseThreadUi?.();
      resetSlash();
      const nextValue = before + after;
      setValue(nextValue);
      requestAnimationFrame(() => {
        const ta = textareaRef.current;
        if (!ta) {
          return;
        }
        ta.focus();
        ta.setSelectionRange(before.length, before.length);
      });
      return;
    }

    const nextValue = before + insertion + after;
    setValue(nextValue);
    resetSlash();

    requestAnimationFrame(() => {
      const ta = textareaRef.current;
      if (!ta) {
        return;
      }
      const pos = (before + insertion).length;
      ta.focus();
      ta.setSelectionRange(pos, pos);
    });
  };

  const applyMention = (item: MentionItem) => {
    if (mentionStart === null || !textareaRef.current) return;
    const caret =
      textareaRef.current.selectionStart ?? value.length;
    const before = value.slice(0, mentionStart);
    const after = value.slice(caret);

    let insertion = '';
    if (item.kind === 'konnecctai') {
      insertion = '@KonnecctAI ';
    } else if (item.kind === 'crm') {
      insertion = `[@${item.label}](${item.href}) `;
    } else if (item.kind === 'agent') {
      insertion = `[@${item.label}](twenty://agent/${item.recordId}) `;
    } else if (item.kind === 'user') {
      insertion = `[@${item.label}](twenty://user/${item.userId}) `;
    }

    const nextValue = before + insertion + after;
    setValue(nextValue);
    resetMention();
    resetSlash();

    requestAnimationFrame(() => {
      const ta = textareaRef.current;
      if (!ta) return;
      const pos = (before + insertion).length;
      ta.focus();
      ta.setSelectionRange(pos, pos);
    });
  };

  const submit = async () => {
    const text = value.trim();
    if (!text || isSending || disabled) return;
    setIsSending(true);
    try {
      await onSend(text);
      setValue('');
      if (draftStorageKey) {
        try {
          localStorage.removeItem(
            CHAT_COMPOSER_DRAFT_PREFIX + draftStorageKey,
          );
        } catch {
          // ignore
        }
      }
      resetMention();
      resetSlash();
      setGifPickerOpen(false);
      enqueueSuccessSnackBar({
        message: t`Message sent`,
        options: { dedupeKey: 'chat-composer-sent' },
      });
      playChatSendSound();
      onTypingEnd?.();
      isTypingRef.current = false;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : t`Could not send message`;
      enqueueErrorSnackBar({ message });
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (gifPickerOpen && e.key === 'Escape') {
      e.preventDefault();
      setGifPickerOpen(false);
      return;
    }

    if (slashOpen && slashItems.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSlashActiveIndex((i) => (i + 1) % slashItems.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSlashActiveIndex(
          (i) => (i - 1 + slashItems.length) % slashItems.length,
        );
        return;
      }
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        applySlashCommand(slashItems[slashActiveIndex]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        resetSlash();
        return;
      }
    }

    if (mentionOpen && mentionItems.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setMentionActiveIndex((i) => (i + 1) % mentionItems.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setMentionActiveIndex(
          (i) => (i - 1 + mentionItems.length) % mentionItems.length,
        );
        return;
      }
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        applyMention(mentionItems[mentionActiveIndex]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        resetMention();
        return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void submit();
    }
  };

  const handleFileClick = () => fileInputRef.current?.click();

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onSendFile) return;
    e.target.value = '';
    try {
      await onSendFile(file);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : t`Could not attach file`;
      enqueueErrorSnackBar({ message });
    }
  };

  return (
    <ChatComposerBar
      hint={t`Enter to send · Shift+Enter for newline · @ mention · / commands`}
    >
      <StyledContainer>
        {gifPickerOpen && gifPickerToken ? (
          <ChatGifPickerPopover
            token={gifPickerToken}
            onClose={() => setGifPickerOpen(false)}
            onPick={(gif) => {
              insertGifMarkdown(gif.url);
              setGifPickerOpen(false);
            }}
          />
        ) : null}
        {slashOpen && slashItems.length > 0 ? (
          <ChatSlashCommandPopover
            items={slashItems}
            activeIndex={slashActiveIndex}
            onSelect={applySlashCommand}
            onHover={setSlashActiveIndex}
          />
        ) : null}
        {mentionOpen && mentionItems.length > 0 && (
          <ChatMentionPopover
            items={mentionItems}
            activeIndex={mentionActiveIndex}
            onSelect={applyMention}
            onHover={setMentionActiveIndex}
          />
        )}
        <StyledRow>
          {gifPickerToken ? (
            <LightIconButton
              Icon={IconPhoto}
              size="medium"
              accent="tertiary"
              disabled={disabled}
              onClick={() => setGifPickerOpen((open) => !open)}
              aria-label={t`Insert GIF`}
              title={t`Insert GIF`}
              aria-expanded={gifPickerOpen}
            />
          ) : null}
          {onSendFile && (
            <>
              <LightIconButton
                Icon={IconPaperclip}
                size="medium"
                accent="tertiary"
                disabled={disabled}
                onClick={handleFileClick}
                aria-label={t`Attach file`}
              />
              <StyledHiddenFileInput
                ref={fileInputRef}
                type="file"
                aria-label={t`Attach file`}
                onChange={handleFileChange}
              />
            </>
          )}
          <StyledTextarea
            ref={textareaRef}
            value={value}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onBlur={() => {
              if (isTypingRef.current) {
                isTypingRef.current = false;
                onTypingEnd?.();
              }
            }}
            placeholder={placeholder ?? t`Message`}
            disabled={disabled || isSending}
            rows={1}
          />
          <Button
            title={t`Send`}
            Icon={IconSend}
            onClick={() => void submit()}
            disabled={disabled || isSending || value.trim().length === 0}
            variant="primary"
            accent="blue"
          />
        </StyledRow>
      </StyledContainer>
    </ChatComposerBar>
  );
});

ChatComposer.displayName = 'ChatComposer';
