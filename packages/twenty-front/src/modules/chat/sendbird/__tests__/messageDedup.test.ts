import { MessageType, type BaseMessage } from '@sendbird/chat/message';
import { describe, expect, it } from 'vitest';

import { upsertMessage } from '@/chat/sendbird/messageDedup';

const makeMessage = (params: { messageId: number; reqId?: string }): BaseMessage =>
  ({
    messageType: MessageType.USER,
    messageId: params.messageId,
    reqId: params.reqId,
    message: 'hello',
  }) as BaseMessage;

describe('messageDedup', () => {
  it('replaces pending message by reqId', () => {
    const pending = makeMessage({ messageId: 0, reqId: 'r-1' });
    const succeeded = makeMessage({ messageId: 42, reqId: 'r-1' });

    expect(upsertMessage([pending], succeeded)).toEqual([succeeded]);
  });

  it('replaces message by messageId', () => {
    const first = makeMessage({ messageId: 101, reqId: 'old' });
    const updated = makeMessage({ messageId: 101, reqId: 'new' });

    expect(upsertMessage([first], updated)).toEqual([updated]);
  });

  it('appends when message is new', () => {
    const a = makeMessage({ messageId: 101, reqId: 'a' });
    const b = makeMessage({ messageId: 102, reqId: 'b' });

    expect(upsertMessage([a], b)).toEqual([a, b]);
  });
});
