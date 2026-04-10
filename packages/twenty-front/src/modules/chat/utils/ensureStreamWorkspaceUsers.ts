/**
 * Upserts workspace peers in Stream before client creates a DM or adds members.
 * Requires the same auth as GET /stream/token.
 */
export async function ensureStreamWorkspaceUsers(params: {
  bearerToken: string;
  clerkOrgId: string | undefined;
  fallbackUid: string;
  scopedUserIds: string[];
}): Promise<void> {
  const { bearerToken, clerkOrgId, fallbackUid, scopedUserIds } = params;

  if (scopedUserIds.length === 0) {
    return;
  }

  const response = await fetch('/stream/ensure-users', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${bearerToken}`,
      ...(clerkOrgId ? { 'X-Clerk-Org-Id': clerkOrgId } : {}),
      'X-Konnecct-Uid-Fallback': fallbackUid,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ scopedUserIds }),
  });

  if (!response.ok) {
    const text = await response.text();
    let detail = text.trim() || `HTTP ${response.status}`;

    try {
      const parsed = JSON.parse(text) as { message?: string };
      if (parsed.message) {
        detail = parsed.message;
      }
    } catch {
      // keep plain text
    }

    throw new Error(detail);
  }
}
