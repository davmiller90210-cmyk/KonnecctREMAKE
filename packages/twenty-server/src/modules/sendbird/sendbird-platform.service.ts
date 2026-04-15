import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type SendbirdApiErrorBody = {
  message?: string;
  code?: number;
};

@Injectable()
export class SendbirdPlatformService {
  private readonly logger = new Logger(SendbirdPlatformService.name);

  constructor(private readonly configService: ConfigService) {}

  get isConfigured(): boolean {
    return Boolean(this.applicationId?.length && this.apiToken?.length);
  }

  private get applicationId(): string {
    return (this.configService.get<string>('SENDBIRD_APPLICATION_ID') ?? '').trim();
  }

  private get apiToken(): string {
    return (this.configService.get<string>('SENDBIRD_API_TOKEN') ?? '').trim();
  }

  private get chatApiBase(): string {
    const override = this.configService.get<string>('SENDBIRD_CHAT_API_BASE')?.trim();
    if (override) {
      return override.replace(/\/$/, '');
    }
    return `https://api-${this.applicationId}.sendbird.com`;
  }

  private get defaultProfileUrl(): string | undefined {
    const explicit = this.configService
      .get<string>('SENDBIRD_DEFAULT_PROFILE_URL')
      ?.trim();
    const explicitSanitized = this.sanitizeProfileUrl(explicit);
    if (explicitSanitized) {
      return explicitSanitized;
    }

    const fromFront = this.configService.get<string>('FRONT_URL')?.trim();
    const fromServer = this.configService.get<string>('SERVER_URL')?.trim();
    const base = fromFront || fromServer;
    if (!base) {
      return undefined;
    }

    try {
      const url = new URL(base);
      url.pathname = '/favicon.ico';
      url.search = '';
      url.hash = '';
      return this.sanitizeProfileUrl(url.toString());
    } catch {
      return undefined;
    }
  }

  private async request<T>(
    method: string,
    path: string,
    body?: Record<string, unknown>,
  ): Promise<T> {
    const url = `${this.chatApiBase}${path}`;
    const headers: Record<string, string> = {
      'Api-Token': this.apiToken,
    };
    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }

    const res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    const text = await res.text();
    let parsed: unknown = null;

    if (text.length > 0) {
      try {
        parsed = JSON.parse(text) as unknown;
      } catch {
        parsed = null;
      }
    }

    if (!res.ok) {
      const msg =
        parsed && typeof parsed === 'object' && parsed !== null && 'message' in parsed
          ? String((parsed as SendbirdApiErrorBody).message)
          : text.slice(0, 300);

      throw new Error(`Sendbird API ${method} ${path}: ${res.status} ${msg}`);
    }

    return parsed as T;
  }

  /**
   * Sendbird may reject profile_url (dashboard domain filter, unreachable URL, etc.).
   * A failed POST with profile_url caused a mistaken PUT fallback and "User not found."
   */
  private sanitizeProfileUrl(url: string | undefined): string | undefined {
    if (!url?.trim()) {
      return undefined;
    }
    const trimmed = url.trim();
    if (trimmed.length > 2048) {
      return undefined;
    }
    try {
      const parsed = new URL(trimmed);
      if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
        return undefined;
      }
      return trimmed;
    } catch {
      return undefined;
    }
  }

  /**
   * User already exists — Sendbird returns different bodies by region/app version.
   */
  private isDuplicateUserCreateError(error: unknown): boolean {
    const msg = error instanceof Error ? error.message : String(error);
    return (
      /400202|400201|unique|already exists|duplicate|violates unique|user_id.*exist/i.test(
        msg,
      )
    );
  }

  /**
   * Create-or-update without relying on GET /v3/users/{id} (some apps return errors
   * that are easy to mis-classify, which blocked POST and broke login entirely).
   */
  async ensureUser(params: {
    userId: string;
    nickname: string;
    profileUrl?: string;
  }): Promise<void> {
    if (!this.isConfigured) {
      return;
    }

    const nickname = (params.nickname?.trim() || params.userId).slice(0, 80);
    const profileUrl = this.sanitizeProfileUrl(params.profileUrl);
    const profileUrlForCreate = profileUrl || this.defaultProfileUrl;
    const userPath = `/v3/users/${encodeURIComponent(params.userId)}`;

    try {
      const createPayload: Record<string, unknown> = {
        user_id: params.userId,
        nickname,
      };
      if (profileUrlForCreate) {
        createPayload.profile_url = profileUrlForCreate;
      }
      await this.request<unknown>('POST', '/v3/users', createPayload);
    } catch (error) {
      if (!this.isDuplicateUserCreateError(error)) {
        throw error;
      }
    }

    const updatePayload: Record<string, unknown> = { nickname };
    if (profileUrl) {
      updatePayload.profile_url = profileUrl;
    }

    try {
      await this.request<unknown>('PUT', userPath, updatePayload);
    } catch (error) {
      if (profileUrl) {
        this.logger.warn(
          `Sendbird: profile_url rejected for ${params.userId} (${error instanceof Error ? error.message : String(error)}). Updating nickname only.`,
        );
        await this.request<unknown>('PUT', userPath, { nickname });
      } else {
        throw error;
      }
    }
  }

  async issueSessionToken(
    userId: string,
    expiresAtMs?: number,
  ): Promise<{ token: string; expires_at: number }> {
    if (!this.isConfigured) {
      throw new Error('Sendbird is not configured');
    }

    const body: Record<string, unknown> = {};
    if (expiresAtMs !== undefined) {
      body.expires_at = expiresAtMs;
    }

    return this.request<{ token: string; expires_at: number }>(
      'POST',
      `/v3/users/${encodeURIComponent(userId)}/token`,
      body,
    );
  }

  async createGroupChannel(params: {
    userIds: string[];
    name: string;
    channelUrl: string;
    isPublic: boolean;
    operatorIds?: string[];
  }): Promise<{ channel_url: string }> {
    if (!this.isConfigured) {
      throw new Error('Sendbird is not configured');
    }

    const unique = [...new Set(params.userIds)];

    const body: Record<string, unknown> = {
      user_ids: unique,
      name: params.name.slice(0, 191),
      channel_url: params.channelUrl,
      is_distinct: false,
      is_public: params.isPublic,
    };

    if (params.operatorIds?.length) {
      body.operator_ids = [...new Set(params.operatorIds)];
    }

    return this.request<{ channel_url: string }>('POST', '/v3/group_channels', body);
  }

  async createDistinctDirectChannel(params: {
    userIds: [string, string];
    name?: string;
  }): Promise<{ channel_url: string }> {
    if (!this.isConfigured) {
      throw new Error('Sendbird is not configured');
    }

    const body: Record<string, unknown> = {
      user_ids: [...new Set(params.userIds)],
      is_distinct: true,
      is_public: false,
    };

    if (params.name) {
      body.name = params.name.slice(0, 191);
    }

    return this.request<{ channel_url: string }>('POST', '/v3/group_channels', body);
  }

  async inviteUsers(channelUrl: string, userIds: string[]): Promise<void> {
    if (!this.isConfigured || userIds.length === 0) {
      return;
    }

    await this.request<unknown>(
      'POST',
      `/v3/group_channels/${encodeURIComponent(channelUrl)}/invite`,
      { user_ids: [...new Set(userIds)] },
    );
  }
}
