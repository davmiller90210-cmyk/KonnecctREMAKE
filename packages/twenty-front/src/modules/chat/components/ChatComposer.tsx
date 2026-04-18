/* eslint-disable twenty/no-state-useref -- composer needs stable refs for textarea/debounce across async events */
import { styled } from '@linaria/react';
import { useLingui } from '@lingui/react/macro';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
} from 'react';
import { ChatMentionPopover } from '@/chat/components/ChatMentionPopover';
import { useCrmMentionSearch } from '@/chat/hooks/useCrmMentionSearch';
import { type MentionItem } from '@/chat/types/MentionItem';
import { Button, LightIconButton } from 'twenty-ui/input';
import { IconPaperclip, IconSend } from 'twenty-ui/display';
import { themeCssVariables } from 'twenty-ui/theme-constants';

const StyledContainer = styled.div`
  background: ${themeCssVariables.background.primary};
  border-top: 1px solid ${themeCssVariables.border.color.light};
  padding: ${themeCssVariables.spacing[3]};
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

const StyledHint = styled.div`
  color: ${themeCssVariables.font.color.tertiary};
  font-family: ${themeCssVariables.font.family};
  font-size: ${themeCssVariables.font.size.xs};
  margin-top: ${themeCssVariables.spacing[1]};
`;

type ChatComposerProps = {
  disabled?: boolean;
  placeholder?: string;
  onSend: (text: string) => Promise<void> | void;
  onSendFile?: (file: File) => Promise<void> | void;
  onTypingStart?: () => void;
  onTypingEnd?: () => void;
};

const MENTION_DEBOUNCE_MS = 150;
const MENTION_REGEX = /@([\w\s]*)$/;

export const ChatComposer = ({
  disabled,
  placeholder,
  onSend,
  onSendFile,
  onTypingStart,
  onTypingEnd,
}: ChatComposerProps) => {
  const { t } = useLingui();
  const { searchMentionRecords } = useCrmMentionSearch();

  const [value, setValue] = useState('');
  const [isSending, setIsSending] = useState(false);

  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionItems, setMentionItems] = useState<MentionItem[]>([]);
  const [mentionActiveIndex, setMentionActiveIndex] = useState(0);
  const [mentionStart, setMentionStart] = useState<number | null>(null);

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

  const autoResize = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, 160)}px`;
  }, []);

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

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    const next = e.target.value;
    setValue(next);
    fireTypingStart();

    const caret = e.target.selectionStart ?? next.length;
    const before = next.slice(0, caret);
    const match = MENTION_REGEX.exec(before);

    if (!match) {
      resetMention();
      return;
    }

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

        setMentionItems([...withAi, ...base]);
      })();
    }, MENTION_DEBOUNCE_MS);
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
    }

    const nextValue = before + insertion + after;
    setValue(nextValue);
    resetMention();

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
      resetMention();
      onTypingEnd?.();
      isTypingRef.current = false;
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
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
    await onSendFile(file);
  };

  return (
    <StyledContainer>
      {mentionOpen && mentionItems.length > 0 && (
        <ChatMentionPopover
          items={mentionItems}
          activeIndex={mentionActiveIndex}
          onSelect={applyMention}
          onHover={setMentionActiveIndex}
        />
      )}
      <StyledRow>
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
      <StyledHint>
        {t`Enter to send · Shift+Enter for newline · Type @ to mention`}
      </StyledHint>
    </StyledContainer>
  );
};
