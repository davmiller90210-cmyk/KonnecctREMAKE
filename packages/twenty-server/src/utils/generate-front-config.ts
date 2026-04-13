import * as fs from 'fs';
import * as path from 'path';

import { config } from 'dotenv';
// Do not override existing process.env (Docker/Kubernetes wins over .env file).
// override:true previously wiped NEXT_PUBLIC_CLERK_* when .env contained empty placeholders.
config({
  path: process.env.NODE_ENV === 'test' ? '.env.test' : '.env',
  override: false,
});

/** Single resolved publishable key for the SPA (aliases + Docker-friendly names). */
function resolveClerkPublishableKey(): string {
  const candidates = [
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
    process.env.REACT_APP_CLERK_PUBLISHABLE_KEY,
    process.env.CLERK_PUBLISHABLE_KEY,
  ];
  for (const value of candidates) {
    const trimmed = value?.trim();
    if (trimmed) {
      return trimmed;
    }
  }
  return '';
}

/** Must match nginx + MM_SERVICESETTINGS_SITEURL (dedicated chat host avoids MM subpath redirect loops). */
function resolveMattermostWebappUrl(): string {
  const explicit = process.env.REACT_APP_MATTERMOST_WEBAPP_URL?.trim();
  if (explicit) {
    return explicit.replace(/\/$/, '');
  }
  const siteUrl = process.env.MATTERMOST_SITE_URL?.trim();
  if (siteUrl) {
    return siteUrl.replace(/\/$/, '');
  }
  return 'https://chat.konnecct.com';
}

export function generateFrontConfig(): void {
  const clerkPublishableKey = resolveClerkPublishableKey();
  const configObject = {
    window: {
      _env_: {
        REACT_APP_SERVER_BASE_URL: process.env.SERVER_URL,
        NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: clerkPublishableKey,
        REACT_APP_CLERK_PUBLISHABLE_KEY: clerkPublishableKey,
        CLERK_PUBLISHABLE_KEY: clerkPublishableKey,
        REACT_APP_STREAM_API_KEY:
          process.env.REACT_APP_STREAM_API_KEY ??
          process.env.STREAM_API_KEY ??
          '',
        STREAM_API_KEY: process.env.STREAM_API_KEY ?? '',
        // Align with docker-compose.prod.yml default (mattermost); explicit env overrides.
        REACT_APP_CHAT_PROVIDER: process.env.REACT_APP_CHAT_PROVIDER ?? 'mattermost',
        REACT_APP_MATTERMOST_WEBAPP_URL: resolveMattermostWebappUrl(),
        REACT_APP_MATTERMOST_SSO_ENTRY_PATH:
          process.env.REACT_APP_MATTERMOST_SSO_ENTRY_PATH?.trim() || '/login',
        REACT_APP_MATTERMOST_USE_NATIVE_HUB:
          process.env.REACT_APP_MATTERMOST_USE_NATIVE_HUB?.trim().toLowerCase() ===
          'true'
            ? 'true'
            : 'false',
      },
    },
  };

  const configString = `<!-- BEGIN: Konnecct Config -->
    <script id="twenty-env-config">
      window._env_ = ${JSON.stringify(configObject.window._env_, null, 2)};
    </script>
    <!-- END: Konnecct Config -->`;

  const distPath = path.join(__dirname, '..', 'front');
  const indexPath = path.join(distPath, 'index.html');

  try {
    let indexContent = fs.readFileSync(indexPath, 'utf8');

    indexContent = indexContent.replace(
      /<!-- BEGIN: Konnecct Config -->[\s\S]*?<!-- END: Konnecct Config -->/,
      configString,
    );

    fs.writeFileSync(indexPath, indexContent, 'utf8');
  } catch {
    // oxlint-disable-next-line no-console
    console.log(
      'Frontend build not found or not writable, assuming it is served independently',
    );
  }
}
