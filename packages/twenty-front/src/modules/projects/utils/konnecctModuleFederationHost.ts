import { getInstance, init } from '@module-federation/runtime';

/**
 * One runtime host for Module Federation. Plane should be built with
 * @module-federation/vite exposing e.g. `./KonnecctShell` and `remoteEntry.js`
 * next to the Plane web bundle (see comment on KonnecctProjectsEmbed).
 */
export const KONNECCT_PLANE_REMOTE_NAME = 'konnecct_plane';

export const ensureKonnecctModuleFederationHost = () => {
  if (getInstance()) {
    return;
  }
  init({
    name: 'konnecct_twenty_host',
    remotes: [],
  });
};
