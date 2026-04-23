import { type ObjectRecord } from '@/object-record/types/ObjectRecord';

type CachedRecord = {
  record: ObjectRecord;
  fetchedAt: number;
};

const cache = new Map<string, CachedRecord>();

const cacheKey = (objectNameSingular: string, recordId: string) =>
  `${objectNameSingular}:${recordId}`;

export const getCachedChatRecordPreview = (
  objectNameSingular: string,
  recordId: string,
): ObjectRecord | undefined => {
  return cache.get(cacheKey(objectNameSingular, recordId))?.record;
};

export const setCachedChatRecordPreview = (
  objectNameSingular: string,
  recordId: string,
  record: ObjectRecord,
): void => {
  cache.set(cacheKey(objectNameSingular, recordId), {
    record,
    fetchedAt: Date.now(),
  });
};
