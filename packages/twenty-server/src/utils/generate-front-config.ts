import * as fs from 'fs';
import * as path from 'path';

import { config } from 'dotenv';
config({
  path: process.env.NODE_ENV === 'test' ? '.env.test' : '.env',
  override: true,
});

/** Same-origin Mattermost path as nginx `location /_konnecct/mattermost/`. */
const KONNECCT_MATTERMOST_PUBLIC_PATH = '/_konnecct/mattermost';

function resolveMattermostWebappUrl(): string {
  const explicit = process.env.REACT_APP_MATTERMOST_WEBAPP_URL?.trim();
  if (explicit) {
    return explicit.replace(/\/$/, '');
  }
  const base = (process.env.FRONT_URL ?? process.env.SERVER_URL ?? '')
    .trim()
    .replace(/\/$/, '');
  if (!base) {
    return '';
  }
  return `${base}${KONNECCT_MATTERMOST_PUBLIC_PATH}`;
}

export function generateFrontConfig(): void {
  const configObject = {
    window: {
      _env_: {
        REACT_APP_SERVER_BASE_URL: process.env.SERVER_URL,
        NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:
          process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? '',
        REACT_APP_CLERK_PUBLISHABLE_KEY:
          process.env.REACT_APP_CLERK_PUBLISHABLE_KEY ?? '',
        REACT_APP_STREAM_API_KEY:
          process.env.REACT_APP_STREAM_API_KEY ??
          process.env.STREAM_API_KEY ??
          '',
        STREAM_API_KEY: process.env.STREAM_API_KEY ?? '',
        REACT_APP_CHAT_PROVIDER: process.env.REACT_APP_CHAT_PROVIDER ?? 'stream',
        REACT_APP_MATTERMOST_WEBAPP_URL: resolveMattermostWebappUrl(),
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
