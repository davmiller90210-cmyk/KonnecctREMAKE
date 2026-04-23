import EmojiPicker, { Theme } from 'emoji-picker-react';

type ChatEmojiPickerLazyPanelProps = {
  onEmojiClick: (emoji: string) => void;
};

export const ChatEmojiPickerLazyPanel = ({
  onEmojiClick,
}: ChatEmojiPickerLazyPanelProps) => {
  return (
    <EmojiPicker
      width={320}
      height={360}
      theme={Theme.AUTO}
      lazyLoadEmojis
      onEmojiClick={(emojiData) => {
        onEmojiClick(emojiData.emoji);
      }}
    />
  );
};
