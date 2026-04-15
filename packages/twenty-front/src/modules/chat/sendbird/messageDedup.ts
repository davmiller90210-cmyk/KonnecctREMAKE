import { type BaseMessage } from '@sendbird/chat/message';

const getReqId = (message: BaseMessage): string | null => {
  const reqId = (message as BaseMessage & { reqId?: string }).reqId;
  return typeof reqId === 'string' && reqId.length > 0 ? reqId : null;
};

const sameMessage = (a: BaseMessage, b: BaseMessage): boolean => {
  if (a.messageId > 0 && b.messageId > 0 && a.messageId === b.messageId) {
    return true;
  }

  const reqA = getReqId(a);
  const reqB = getReqId(b);

  return reqA !== null && reqB !== null && reqA === reqB;
};

/** Insert/replace by reqId or messageId so pending/succeeded/received renders once. */
export const upsertMessage = <T extends BaseMessage>(
  messages: T[],
  message: T,
): T[] => {
  const index = messages.findIndex((m) => sameMessage(m, message));

  if (index < 0) {
    return [...messages, message];
  }

  const next = [...messages];
  next[index] = message;

  return next;
};
