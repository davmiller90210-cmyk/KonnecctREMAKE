import { MessageType, type UserMessage } from '@sendbird/chat/message';
import { describe, expect, it } from 'vitest';

import {
  COLLAB_NOTE_CUSTOM_TYPE,
  filterMainFeedMessages,
  isCollabNoteMessage,
} from '../collabNote';

const mockUserMessage = (customType?: string): UserMessage =>
  ({
    messageType: MessageType.USER,
    messageId: 1,
    customType: customType ?? '',
    message: 'hi',
  }) as UserMessage;

describe('collabNote', () => {
  it('detects collaborative note custom type', () => {
    expect(isCollabNoteMessage(mockUserMessage(COLLAB_NOTE_CUSTOM_TYPE))).toBe(true);
    expect(isCollabNoteMessage(mockUserMessage(''))).toBe(false);
    expect(isCollabNoteMessage(mockUserMessage('other'))).toBe(false);
  });

  it('filterMainFeedMessages removes collab notes only', () => {
    const a = mockUserMessage('');
    const b = mockUserMessage(COLLAB_NOTE_CUSTOM_TYPE);
    const c = mockUserMessage('');
    expect(filterMainFeedMessages([a, b, c])).toEqual([a, c]);
  });
});
