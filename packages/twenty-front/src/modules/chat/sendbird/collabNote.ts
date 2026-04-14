import { MessageType, type BaseMessage, type UserMessage } from '@sendbird/chat/message';

/** Custom Sendbird user-message type for collaborative notes (hidden from main transcript). */
export const COLLAB_NOTE_CUSTOM_TYPE = 'konnecct_collab_note';

export const isCollabNoteMessage = (message: BaseMessage): boolean => {
  if (message.messageType !== MessageType.USER) {
    return false;
  }
  const customType = (message as UserMessage).customType?.trim();
  return customType === COLLAB_NOTE_CUSTOM_TYPE;
};

/** Main channel feed should never list collaborative notes. */
export const filterMainFeedMessages = <T extends BaseMessage>(messages: T[]): T[] =>
  messages.filter((m) => !isCollabNoteMessage(m));
