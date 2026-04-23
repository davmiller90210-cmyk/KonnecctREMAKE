import { styled } from '@linaria/react';
import { useLingui } from '@lingui/react/macro';

import { type NativeChatPinnedMessage } from '@/chat/types/native-chat-message.type';
import { themeCssVariables } from 'twenty-ui/theme-constants';
import { IconPin } from 'twenty-ui/display';

const StyledWrap = styled.div`
  background: ${themeCssVariables.background.secondary};
  border-bottom: 1px solid ${themeCssVariables.border.color.light};
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[1]};
  padding: ${themeCssVariables.spacing[2]} ${themeCssVariables.spacing[3]};
`;

const StyledLabel = styled.div`
  align-items: center;
  color: ${themeCssVariables.font.color.tertiary};
  display: flex;
  font-family: ${themeCssVariables.font.family};
  font-size: ${themeCssVariables.font.size.xs};
  gap: ${themeCssVariables.spacing[1]};
`;

const StyledList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

const StyledPinRow = styled.button`
  background: transparent;
  border: none;
  border-radius: ${themeCssVariables.border.radius.sm};
  color: ${themeCssVariables.font.color.primary};
  cursor: pointer;
  font-family: ${themeCssVariables.font.family};
  font-size: ${themeCssVariables.font.size.sm};
  padding: ${themeCssVariables.spacing[1]} ${themeCssVariables.spacing[1]};
  text-align: left;

  &:hover {
    background: ${themeCssVariables.background.transparent.light};
  }
`;

type ChatPinnedMessagesStripProps = {
  pins: NativeChatPinnedMessage[];
  onSelectMessageId: (messageId: string) => void;
};

export const ChatPinnedMessagesStrip = ({
  pins,
  onSelectMessageId,
}: ChatPinnedMessagesStripProps) => {
  const { t } = useLingui();

  if (pins.length === 0) {
    return null;
  }

  return (
    <StyledWrap>
      <StyledLabel>
        <IconPin />
        {t`Pinned`}
      </StyledLabel>
      <StyledList>
        {pins.map((pin) => (
          <StyledPinRow
            key={pin.id}
            type="button"
            onClick={() => {
              onSelectMessageId(pin.messageId);
            }}
          >
            {pin.bodyPreview}
          </StyledPinRow>
        ))}
      </StyledList>
    </StyledWrap>
  );
};
