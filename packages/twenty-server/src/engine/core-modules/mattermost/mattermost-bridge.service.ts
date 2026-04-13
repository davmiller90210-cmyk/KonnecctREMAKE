import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { isDefined } from 'twenty-shared/utils';

import { SecretEncryptionService } from 'src/engine/core-modules/secret-encryption/secret-encryption.service';
import { UserEntity } from 'src/engine/core-modules/user/user.entity';
import { MattermostUserCredentialEntity } from 'src/engine/core-modules/mattermost/mattermost-user-credential.entity';
import { resolveMattermostProvisionToken } from 'src/engine/core-modules/mattermost/mattermost-provision-token.util';

const TOKEN_DESCRIPTION = 'Konnecct CRM';

const MM_NOT_LINKED_MESSAGE =
  'Mattermost is not linked for this CRM user yet. Paste a Personal Access Token from Mattermost (Profile → Security) using the link below in the app, or set MATTERMOST_ADMIN_TOKEN, MATTERMOST_PROVISIONING_TOKEN, or MATTERMOST_ADMIN_TOKEN_FILE on crm-server for automatic provisioning.';

@Injectable()
export class MattermostBridgeService {
  private readonly logger = new Logger(MattermostBridgeService.name);

  constructor(
    @InjectRepository(MattermostUserCredentialEntity)
    private readonly credentialRepository: Repository<MattermostUserCredentialEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    private readonly secretEncryptionService: SecretEncryptionService,
  ) {}

  private get baseUrl(): string | undefined {
    const u = process.env.MATTERMOST_SITE_URL?.trim();
    return u ? u.replace(/\/$/, '') : undefined;
  }

  private get adminToken(): string | undefined {
    return resolveMattermostProvisionToken();
  }

  /**
   * True when the API knows where Mattermost lives. Admin token is only
   * required to provision a user the first time (see getSessionForTwentyUser).
   */
  isConfigured(): boolean {
    return Boolean(this.baseUrl);
  }

  /**
   * Allow-list for BFF-forwarded Mattermost v4 routes (method + path without query).
   * Extend deliberately when the native client needs new capabilities.
   */
  private assertForwardAllowed(method: string, pathOnly: string): void {
    const m = method.toUpperCase();

    if (pathOnly.includes('..') || !pathOnly.startsWith('/api/v4/')) {
      throw new BadRequestException('invalid path');
    }

    if (m === 'GET') {
      const allowedGet =
        pathOnly === '/api/v4/users/me/channels' ||
        pathOnly === '/api/v4/users/me/teams' ||
        pathOnly === '/api/v4/users/me' ||
        pathOnly.startsWith('/api/v4/users/ids') ||
        pathOnly.startsWith('/api/v4/users/autocomplete') ||
        /^\/api\/v4\/channels\/[^/]+\/posts$/.test(pathOnly) ||
        /^\/api\/v4\/posts\/[^/]+\/thread$/.test(pathOnly) ||
        /^\/api\/v4\/posts\/[^/]+$/.test(pathOnly) ||
        /^\/api\/v4\/users\/(?!me$)[^/]+$/.test(pathOnly);

      if (allowedGet) {
        return;
      }

      throw new BadRequestException('path not allowed for GET');
    }

    if (m === 'POST') {
      if (
        pathOnly === '/api/v4/posts' ||
        pathOnly === '/api/v4/reactions'
      ) {
        return;
      }

      throw new BadRequestException('path not allowed for POST');
    }

    if (m === 'DELETE') {
      if (
        /^\/api\/v4\/users\/[^/]+\/posts\/[^/]+\/reactions\/[^/]+$/.test(
          pathOnly,
        )
      ) {
        return;
      }

      throw new BadRequestException('path not allowed for DELETE');
    }

    throw new BadRequestException('method and path are not allowed');
  }

  /**
   * Upload a single file to Mattermost (multipart). Not proxied through JSON forward.
   */
  async uploadFile(
    userId: string,
    channelId: string,
    file: {
      buffer: Buffer;
      originalname: string;
      mimetype?: string;
    },
  ): Promise<unknown> {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Empty file');
    }

    const { baseUrl, token } = await this.getSessionForTwentyUser(userId);
    const url = `${baseUrl}/api/v4/files?channel_id=${encodeURIComponent(channelId)}`;
    const blob = new Blob([new Uint8Array(file.buffer)], {
      type: file.mimetype || 'application/octet-stream',
    });
    const form = new FormData();

    form.append('files', blob, file.originalname);

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: form,
    });

    const text = await res.text();
    let data: unknown = null;

    try {
      data = text.length > 0 ? JSON.parse(text) : null;
    } catch {
      throw new BadRequestException('Mattermost file upload returned invalid JSON');
    }

    if (!res.ok) {
      const msg =
        typeof data === 'object' &&
        data !== null &&
        'message' in data &&
        typeof (data as { message: unknown }).message === 'string'
          ? (data as { message: string }).message
          : text.slice(0, 400);

      throw new BadRequestException(
        msg || `Mattermost file upload failed (${res.status})`,
      );
    }

    return data;
  }

  /**
   * Proxies a subset of Mattermost v4 API calls using the vault PAT.
   */
  async forwardV4(
    userId: string,
    dto: { method: string; path: string; body?: unknown },
  ): Promise<
    | { status: number; kind: 'json'; data: unknown }
    | { status: number; kind: 'text'; text: string }
  > {
    const method = (dto.method ?? 'GET').toUpperCase();
    const allowedMethods = new Set(['GET', 'POST', 'DELETE']);

    if (!allowedMethods.has(method)) {
      throw new BadRequestException('Unsupported HTTP method');
    }

    const rawPath = dto.path?.trim() ?? '';
    const pathOnly = rawPath.split('?')[0] ?? '';

    this.assertForwardAllowed(method, pathOnly);

    const pathForUrl = rawPath.startsWith('/') ? rawPath : `/${rawPath}`;
    const { baseUrl, token } = await this.getSessionForTwentyUser(userId);
    const url = `${baseUrl}${pathForUrl}`;

    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
    };

    const init: RequestInit = {
      method,
      headers,
    };

    if (
      method !== 'GET' &&
      method !== 'DELETE' &&
      dto.body !== undefined
    ) {
      headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(dto.body);
    }

    const res = await fetch(url, init);
    const contentType = res.headers.get('content-type') ?? '';

    if (contentType.includes('application/json')) {
      const text = await res.text();

      try {
        const data = text.length > 0 ? JSON.parse(text) : null;

        return { status: res.status, kind: 'json', data };
      } catch {
        return { status: res.status, kind: 'text', text };
      }
    }

    return { status: res.status, kind: 'text', text: await res.text() };
  }

  /**
   * After Mattermost user exists, create a PAT with the provisioning token and store it.
   * Used on workspace join and as a best-effort backfill when env allows.
   */
  async ensureVaultPatForTwentyUser(userId: string): Promise<boolean> {
    const existing = await this.credentialRepository.findOne({
      where: { userId },
    });

    if (existing) {
      return true;
    }

    const baseUrl = this.baseUrl;
    const adminToken = this.adminToken;

    if (!isDefined(baseUrl) || !isDefined(adminToken)) {
      return false;
    }

    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      return false;
    }

    try {
      await this.createAndPersistPatWithAdmin(userId, user, baseUrl, adminToken);

      return true;
    } catch (error) {
      this.logger.warn(
        `ensureVaultPatForTwentyUser failed for ${userId}: ${String(error)}`,
      );

      return false;
    }
  }

  /**
   * User pastes their own Mattermost PAT (Profile → Security). No system admin token required.
   */
  async linkPersonalAccessTokenForTwentyUser(
    userId: string,
    rawToken: string,
  ): Promise<void> {
    const baseUrl = this.baseUrl;

    if (!isDefined(baseUrl)) {
      throw new ServiceUnavailableException(
        'Mattermost bridge is not configured (set MATTERMOST_SITE_URL on crm-server).',
      );
    }

    const token = rawToken.trim();

    if (token.length === 0) {
      throw new BadRequestException('token is required');
    }

    const meRes = await fetch(`${baseUrl}/api/v4/users/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!meRes.ok) {
      const body = await meRes.text();

      throw new BadRequestException(
        `That token is not accepted by Mattermost (${meRes.status}). Create a Personal Access Token under Profile → Security and paste the full value. ${body.slice(0, 200)}`,
      );
    }

    const me = (await meRes.json()) as { id: string };
    const encrypted = this.secretEncryptionService.encrypt(token);
    const existing = await this.credentialRepository.findOne({
      where: { userId },
    });

    if (existing) {
      existing.encryptedToken = encrypted;
      existing.mattermostUserId = me.id;
      await this.credentialRepository.save(existing);

      return;
    }

    await this.credentialRepository.save(
      this.credentialRepository.create({
        userId,
        mattermostUserId: me.id,
        encryptedToken: encrypted,
        tokenDescription: TOKEN_DESCRIPTION,
      }),
    );
  }

  private async createAndPersistPatWithAdmin(
    userId: string,
    user: UserEntity,
    baseUrl: string,
    adminToken: string,
  ): Promise<{ token: string; mattermostUserId: string }> {
    const mmUserId = await this.resolveOrCreateMattermostUser(
      baseUrl,
      adminToken,
      user,
    );

    const createTokenRes = await fetch(
      `${baseUrl}/api/v4/users/${encodeURIComponent(mmUserId)}/tokens`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ description: TOKEN_DESCRIPTION }),
      },
    );

    if (!createTokenRes.ok) {
      const body = await createTokenRes.text();
      this.logger.error(
        `Mattermost create token failed ${createTokenRes.status}: ${body.slice(0, 400)}`,
      );
      throw new ServiceUnavailableException(
        'Could not create Mattermost personal access token (check server admin permissions).',
      );
    }

    const tokenPayload = (await createTokenRes.json()) as {
      token?: string;
    };

    if (!tokenPayload.token) {
      throw new ServiceUnavailableException(
        'Mattermost token response missing token field',
      );
    }

    const encrypted = this.secretEncryptionService.encrypt(tokenPayload.token);

    await this.credentialRepository.save(
      this.credentialRepository.create({
        userId,
        mattermostUserId: mmUserId,
        encryptedToken: encrypted,
        tokenDescription: TOKEN_DESCRIPTION,
      }),
    );

    return {
      token: tokenPayload.token,
      mattermostUserId: mmUserId,
    };
  }

  async getSessionForTwentyUser(userId: string): Promise<{
    baseUrl: string;
    token: string;
    mattermostUserId: string;
  }> {
    const baseUrl = this.baseUrl;

    if (!isDefined(baseUrl)) {
      throw new ServiceUnavailableException(
        'Mattermost bridge is not configured (set MATTERMOST_SITE_URL on crm-server).',
      );
    }

    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new ServiceUnavailableException('User not found');
    }

    let existing = await this.credentialRepository.findOne({
      where: { userId },
    });

    if (existing) {
      const token = this.secretEncryptionService.decrypt(existing.encryptedToken);

      return {
        baseUrl,
        token,
        mattermostUserId: existing.mattermostUserId,
      };
    }

    await this.ensureVaultPatForTwentyUser(userId);

    existing = await this.credentialRepository.findOne({
      where: { userId },
    });

    if (existing) {
      const token = this.secretEncryptionService.decrypt(existing.encryptedToken);

      return {
        baseUrl,
        token,
        mattermostUserId: existing.mattermostUserId,
      };
    }

    const adminToken = this.adminToken;

    if (!isDefined(adminToken)) {
      throw new ServiceUnavailableException(MM_NOT_LINKED_MESSAGE);
    }

    const { token, mattermostUserId } = await this.createAndPersistPatWithAdmin(
      userId,
      user,
      baseUrl,
      adminToken,
    );

    return {
      baseUrl,
      token,
      mattermostUserId,
    };
  }

  private async resolveOrCreateMattermostUser(
    baseUrl: string,
    adminToken: string,
    user: UserEntity,
  ): Promise<string> {
    const email = user.email.toLowerCase();
    const getRes = await fetch(
      `${baseUrl}/api/v4/users/email/${encodeURIComponent(email)}`,
      {
        headers: { Authorization: `Bearer ${adminToken}` },
      },
    );

    if (getRes.ok) {
      const mmUser = (await getRes.json()) as { id: string };
      return mmUser.id;
    }

    if (getRes.status !== 404) {
      const body = await getRes.text();
      throw new Error(`Mattermost lookup user: ${getRes.status} ${body.slice(0, 200)}`);
    }

    const clerkSub = await this.tryResolveClerkUserIdByEmail(email);
    const username = await this.allocateUsername(baseUrl, adminToken, email, user.id);

    const payload: Record<string, string> = {
      email,
      username,
      first_name: user.firstName ?? '',
      last_name: user.lastName ?? '',
    };

    if (isDefined(clerkSub) && clerkSub.length > 0) {
      payload.auth_service = 'openid';
      payload.auth_data = clerkSub;
    }

    const createRes = await fetch(`${baseUrl}/api/v4/users`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!createRes.ok && createRes.status !== 409) {
      const errBody = await createRes.text();
      throw new Error(
        `Mattermost create user: ${createRes.status} ${errBody.slice(0, 300)}`,
      );
    }

    const after = await fetch(
      `${baseUrl}/api/v4/users/email/${encodeURIComponent(email)}`,
      {
        headers: { Authorization: `Bearer ${adminToken}` },
      },
    );

    if (!after.ok) {
      throw new Error('Mattermost user not found after create');
    }

    const mmUser = (await after.json()) as { id: string };
    return mmUser.id;
  }

  private async tryResolveClerkUserIdByEmail(
    email: string,
  ): Promise<string | undefined> {
    const secretKey = process.env.CLERK_SECRET_KEY?.trim();
    if (!secretKey) {
      return undefined;
    }
    try {
      const { createClerkClient } = await import('@clerk/backend');
      const clerk = createClerkClient({ secretKey });
      const list = await clerk.users.getUserList({
        emailAddress: [email],
        limit: 1,
      });
      return list.data[0]?.id;
    } catch {
      return undefined;
    }
  }

  private deriveUsernameCandidate(email: string, userId: string): string {
    const local = email.split('@')[0] ?? 'user';
    let base = local
      .toLowerCase()
      .replace(/[^a-z0-9._-]/g, '_')
      .replace(/^[._-]+/, '')
      .slice(0, 22);

    if (base.length < 3) {
      base = `u_${userId.replace(/-/g, '').slice(0, 20)}`;
    }

    return base.slice(0, 22);
  }

  private async allocateUsername(
    baseUrl: string,
    adminToken: string,
    email: string,
    userId: string,
  ): Promise<string> {
    let candidate = this.deriveUsernameCandidate(email, userId);

    for (let i = 0; i < 8; i += 1) {
      const check = await fetch(
        `${baseUrl}/api/v4/users/username/${encodeURIComponent(candidate)}`,
        {
          headers: { Authorization: `Bearer ${adminToken}` },
        },
      );

      if (check.status === 404) {
        return candidate;
      }

      const suffix = `_${i + 1}`;
      const stem = candidate.slice(0, Math.max(1, 22 - suffix.length));
      candidate = `${stem}${suffix}`;
    }

    return `u_${userId.replace(/-/g, '').slice(0, 18)}`;
  }
}
