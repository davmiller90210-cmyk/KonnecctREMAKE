import { readFileSync } from 'fs';

/**
 * System / service token used only to create Mattermost users and issue PATs.
 * Supports Docker secrets file and common env aliases.
 */
export const resolveMattermostProvisionToken = (): string | undefined => {
  const candidates = [
    process.env.MATTERMOST_ADMIN_TOKEN,
    process.env.MATTERMOST_PROVISIONING_TOKEN,
    process.env.MATTERMOST_SYSTEM_USER_TOKEN,
    process.env.MM_ADMIN_TOKEN,
  ];

  for (const c of candidates) {
    const t = c?.trim();

    if (t && t.length > 0) {
      return t;
    }
  }

  const file = process.env.MATTERMOST_ADMIN_TOKEN_FILE?.trim();

  if (file) {
    try {
      const raw = readFileSync(file, 'utf8').trim();

      if (raw.length > 0) {
        return raw;
      }
    } catch {
      // caller may log
    }
  }

  return undefined;
};
