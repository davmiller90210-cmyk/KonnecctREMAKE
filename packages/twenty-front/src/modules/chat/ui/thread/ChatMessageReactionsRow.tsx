import { styled } from '@linaria/react';
import { useLingui } from '@lingui/react/macro';
import { lazy, Suspense, useEffect, useRef, useState } from 'react';

import { CHAT_QUICK_REACTION_EMOJIS } from '@/chat/constants/chatQuickReactions';
import { type NativeChatReactionSummary } from '@/chat/types/native-chat-message.type';
import { LightIconButton } from 'twenty-ui/input';
import { IconMoodSmile } from 'twenty-ui/display';
import { themeCssVariables } from 'twenty-ui/theme-constants';

const ChatEmojiPickerLazyPanel = lazy(async () => {
  const mod = await import('@/chat/components/ChatEmojiPickerLazyPanel');
  return { default: mod.ChatEmojiPickerLazyPanel };
});

const StyledRow = styled.div<{ $own: boolean }>`
  display: flex;
  flex-wrap: wrap;
  gap: ${themeCssVariables.spacing[1]};
  justify-content: ${({ $own }) => ($own ? 'flex-end' : 'flex-start')};
  max-width: 100%;
  position: relative;
`;

const StyledChip = styled.button<{ $active?: boolean }>`
  align-items: center;
  background: ${({ $active }) =>
    $active
      ? themeCssVariables.background.transparent.blue
      : themeCssVariables.background.transparent.light};
  border: 1px solid
    ${({ $active }) =>
      $active
        ? themeCssVariables.border.color.blue
        : themeCssVariables.border.color.light};
  border-radius: ${themeCssVariables.border.radius.sm};
  color: ${themeCssVariables.font.color.primary};
  cursor: pointer;
  display: inline-flex;
  font-family: ${themeCssVariables.font.family};
  font-size: ${themeCssVariables.font.size.xs};
  gap: 4px;
  line-height: 1;
  padding: 2px ${themeCssVariables.spacing[1]};

  &:disabled {
    cursor: default;
    opacity: 0.45;
  }

  &:hover:not(:disabled) {
    background: ${themeCssVariables.background.transparent.medium};
  }
`;

const StyledEmoji = styled.span`
  font-size: ${themeCssVariables.font.size.md};
  line-height: 1;
`;

const StyledEmojiPopover = styled.div<{ $alignEnd: boolean }>`
  background: ${themeCssVariables.background.primary};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.sm};
  bottom: calc(100% + ${themeCssVariables.spacing[1]});
  box-shadow: ${themeCssVariables.boxShadow.strong};
  left: ${({ $alignEnd }) => ($alignEnd ? 'auto' : '0')};
  max-width: min(340px, calc(100vw - 24px));
  position: absolute;
  right: ${({ $alignEnd }) => ($alignEnd ? '0' : 'auto')};
  z-index: 50;
`;

const StyledPickerFallback = styled.div`
  align-items: center;
  color: ${themeCssVariables.font.color.tertiary};
  display: flex;
  font-family: ${themeCssVariables.font.family};
  font-size: ${themeCssVariables.font.size.sm};
  height: 360px;
  justify-content: center;
  width: 320px;
`;

type ChatMessageReactionsRowProps = {
  isOwn: boolean;
  reactions: NativeChatReactionSummary[] | undefined;
  disabled?: boolean;
  onToggle?: (emoji: string, remove: boolean) => void;
};

export const ChatMessageReactionsRow = ({
  isOwn,
  reactions,
  disabled,
  onToggle,
}: ChatMessageReactionsRowProps) => {
  const { t } = useLingui();
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  const byEmoji = new Map(
    (reactions ?? []).map((row) => [row.emoji, row] as const),
  );

  const quickSet = CHAT_QUICK_REACTION_EMOJIS as readonly string[];
  const extra = (reactions ?? []).filter((row) => !quickSet.includes(row.emoji));

  const handlePick = (emoji: string) => {
    if (disabled || !onToggle) {
      return;
    }
    const row = byEmoji.get(emoji);
    onToggle(emoji, Boolean(row?.viewerReacted));
  };

  useEffect(() => {
    if (!emojiPickerOpen) {
      return;
    }

    const onPointerDown = (event: PointerEvent) => {
      const node = popoverRef.current;
      if (node && !node.contains(event.target as Node)) {
        setEmojiPickerOpen(false);
      }
    };

    document.addEventListener('pointerdown', onPointerDown, true);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
    };
  }, [emojiPickerOpen]);

  return (
    <StyledRow $own={isOwn} aria-label={t`Reactions`}>
      {CHAT_QUICK_REACTION_EMOJIS.map((emoji) => {
        const row = byEmoji.get(emoji);
        const count = row?.count ?? 0;
        return (
          <StyledChip
            key={emoji}
            type="button"
            disabled={disabled}
            $active={row?.viewerReacted === true}
            onClick={() => {
              handlePick(emoji);
            }}
            title={emoji}
          >
            <StyledEmoji>{emoji}</StyledEmoji>
            {count > 0 ? <span>{count}</span> : null}
          </StyledChip>
        );
      })}
      {extra.map((row) => (
        <StyledChip
          key={row.emoji}
          type="button"
          disabled={disabled}
          $active={row.viewerReacted}
          onClick={() => {
            handlePick(row.emoji);
          }}
        >
          <StyledEmoji>{row.emoji}</StyledEmoji>
          <span>{row.count}</span>
        </StyledChip>
      ))}
      {!disabled && onToggle ? (
        <>
          <LightIconButton
            Icon={IconMoodSmile}
            size="small"
            accent="tertiary"
            aria-label={t`More reactions`}
            aria-expanded={emojiPickerOpen}
            onClick={() => setEmojiPickerOpen((open) => !open)}
          />
          {emojiPickerOpen ? (
            <StyledEmojiPopover ref={popoverRef} $alignEnd={isOwn}>
              <Suspense
                fallback={<StyledPickerFallback>{t`Loading…`}</StyledPickerFallback>}
              >
                <ChatEmojiPickerLazyPanel
                  onEmojiClick={(emoji) => {
                    handlePick(emoji);
                    setEmojiPickerOpen(false);
                  }}
                />
              </Suspense>
            </StyledEmojiPopover>
          ) : null}
        </>
      ) : null}
    </StyledRow>
  );
};
