import * as fs from 'fs';
import * as path from 'path';

import { config } from 'dotenv';
config({
  path: process.env.NODE_ENV === 'test' ? '.env.test' : '.env',
  override: true,
});

export function generateFrontConfig(): void {
  const configObject = {
    window: {
      _env_: {
        REACT_APP_SERVER_BASE_URL: process.env.SERVER_URL,
        NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:
          process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? '',
        REACT_APP_CLERK_PUBLISHABLE_KEY:
          process.env.REACT_APP_CLERK_PUBLISHABLE_KEY ?? '',
        AGORA_CHAT_APP_KEY:
          process.env.AGORA_CHAT_APP_KEY ?? '7110032205#200010602',
        AGORA_CHAT_REST_HOST:
          process.env.AGORA_CHAT_REST_HOST ?? 'a71.chat.agora.io',
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
