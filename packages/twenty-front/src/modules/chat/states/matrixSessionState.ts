import { atom } from 'jotai';

/**
 * Stores the Matrix session obtained from the CRM backend /matrix/token endpoint.
 * This is the ONLY place Matrix credentials live in the frontend.
 * They are never persisted to localStorage — they are re-fetched after each CRM login.
 */
export type MatrixSession = {
  accessToken: string;
  userId: string;
  deviceId: string;
  homeserverUrl: string;
};

export const matrixSessionState = atom<MatrixSession | null>(null);

/**
 * Tracks whether the Matrix client has started syncing (connected to the homeserver).
 * Used to gate rendering of the CommunicationHub until the first sync completes.
 */
export const matrixSyncedState = atom<boolean>(false);
