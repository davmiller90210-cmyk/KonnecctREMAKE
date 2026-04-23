import { createAtomState } from '@/ui/utilities/state/jotai/utils/createAtomState';

/** When true (desktop), CRM nav collapses and a full-width chat list rail sits beside it. */
export const isChatConversationRailOpenState = createAtomState<boolean>({
  key: 'isChatConversationRailOpen',
  defaultValue: false,
});
