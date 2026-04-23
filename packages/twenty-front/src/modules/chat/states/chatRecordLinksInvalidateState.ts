import { createAtomState } from '@/ui/utilities/state/jotai/utils/createAtomState';

/** Bumped when SSE signals record ↔ chat links may have changed for a CRM record. */
export const chatRecordLinksInvalidateState = createAtomState<{
  nonce: number;
  objectNameSingular?: string;
  recordId?: string;
}>({
  key: 'chatRecordLinksInvalidate',
  defaultValue: { nonce: 0 },
});
