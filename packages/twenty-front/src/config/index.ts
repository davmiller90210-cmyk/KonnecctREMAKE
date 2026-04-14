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
  window._env_?.CLERK_PUBLISHABLE_KEY ||
  process.env.CLERK_PUBLISHABLE_KEY ||
  '';

export const REACT_APP_STREAM_API_KEY =
  window._env_?.REACT_APP_STREAM_API_KEY ||
  window._env_?.STREAM_API_KEY ||
  process.env.REACT_APP_STREAM_API_KEY ||
  process.env.STREAM_API_KEY ||
  '';

/** `sendbird` | `mattermost` | `stream` */
export const REACT_APP_CHAT_PROVIDER = (
  window._env_?.REACT_APP_CHAT_PROVIDER ||
  process.env.REACT_APP_CHAT_PROVIDER ||
  'sendbird'
)
  .trim()
  .toLowerCase();

export const REACT_APP_SENDBIRD_APP_ID = (
  window._env_?.REACT_APP_SENDBIRD_APP_ID ||
  process.env.REACT_APP_SENDBIRD_APP_ID ||
  ''
).trim();

/**
 * Mattermost web URL (no trailing slash). Prefer dedicated host, e.g. `https://chat.<domain>` — injected at runtime by the API.
 */
export const REACT_APP_MATTERMOST_WEBAPP_URL = (() => {
  const fromEnv =
    window._env_?.REACT_APP_MATTERMOST_WEBAPP_URL ||
    process.env.REACT_APP_MATTERMOST_WEBAPP_URL ||
    '';
  return fromEnv.trim().replace(/\/$/, '');
})();

/** Mattermost login path opened in a popup for SSO handoff (first-party cookies on chat host). */
export const REACT_APP_MATTERMOST_SSO_ENTRY_PATH = (() => {
  const fromEnv =
    window._env_?.REACT_APP_MATTERMOST_SSO_ENTRY_PATH ||
    process.env.REACT_APP_MATTERMOST_SSO_ENTRY_PATH ||
    '/login';
  const trimmed = fromEnv.trim();
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
})();

/**
 * When true, /chat uses the native Mattermost REST client (PAT vault + optional admin provisioning).
 * Default false: iframe embed + OIDC on the chat host (no Mattermost admin token required).
 */
export const REACT_APP_MATTERMOST_USE_NATIVE_HUB = (() => {
  const w = window._env_?.REACT_APP_MATTERMOST_USE_NATIVE_HUB;
  if (typeof w === 'string') {
    return w.trim().toLowerCase() === 'true';
  }
  const raw = process.env.REACT_APP_MATTERMOST_USE_NATIVE_HUB || '';
  return raw.trim().toLowerCase() === 'true';
})();
