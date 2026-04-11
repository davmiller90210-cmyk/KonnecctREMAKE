const getDefaultUrl = () => {
  if (
    window.location.hostname.endsWith('localhost') ||
    window.location.hostname.endsWith('127.0.0.1')
  ) {
    // In development environment front and backend usually run on separate ports
    // we set the default value to localhost:3000.
    // In dev context, we use env vars to overwrite it
    return `http://${window.location.hostname}:3000`;
  } else {
    // Outside of localhost we assume that they run on the same port
    // because the backend will serve the frontend
    // In prod context, we use index.html + window var to ovewrite it
    return `${window.location.protocol}//${window.location.hostname}${
      window.location.port ? `:${window.location.port}` : ''
    }`;
  }
};

export const REACT_APP_SERVER_BASE_URL =
  window._env_?.REACT_APP_SERVER_BASE_URL ||
  process.env.REACT_APP_SERVER_BASE_URL ||
  getDefaultUrl();

export const CLERK_PUBLISHABLE_KEY =
  window._env_?.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ||
  window._env_?.REACT_APP_CLERK_PUBLISHABLE_KEY ||
  process.env.REACT_APP_CLERK_PUBLISHABLE_KEY ||
  '';

export const REACT_APP_STREAM_API_KEY =
  window._env_?.REACT_APP_STREAM_API_KEY ||
  window._env_?.STREAM_API_KEY ||
  process.env.REACT_APP_STREAM_API_KEY ||
  process.env.STREAM_API_KEY ||
  '';

/** Same-origin Mattermost path as production nginx (keep in sync with server `generate-front-config`). */
export const KONNECCT_MATTERMOST_PUBLIC_PATH = '/_konnecct/mattermost';

/** `stream` (default) | `mattermost` */
export const REACT_APP_CHAT_PROVIDER = (
  window._env_?.REACT_APP_CHAT_PROVIDER ||
  process.env.REACT_APP_CHAT_PROVIDER ||
  'stream'
)
  .trim()
  .toLowerCase();

/**
 * Public Mattermost webapp URL — no trailing slash (must match MM Site URL + nginx).
 */
export const REACT_APP_MATTERMOST_WEBAPP_URL = (() => {
  const fromEnv =
    window._env_?.REACT_APP_MATTERMOST_WEBAPP_URL ||
    process.env.REACT_APP_MATTERMOST_WEBAPP_URL ||
    '';
  const trimmed = fromEnv.trim().replace(/\/$/, '');
  if (trimmed) {
    return trimmed;
  }
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}${KONNECCT_MATTERMOST_PUBLIC_PATH}`;
  }
  return '';
})();
