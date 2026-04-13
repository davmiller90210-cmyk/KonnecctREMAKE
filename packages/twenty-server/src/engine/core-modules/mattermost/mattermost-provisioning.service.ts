import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { createClerkClient } from '@clerk/backend';
import { isDefined } from 'twenty-shared/utils';

import { AUTH_CONTEXT_USER_SELECT_FIELDS } from 'src/engine/core-modules/auth/constants/auth-context-user-select-fields.constants';
import { type AuthContextUser } from 'src/engine/core-modules/auth/types/auth-context.type';
import { MattermostBridgeService } from 'src/engine/core-modules/mattermost/mattermost-bridge.service';
import { resolveMattermostProvisionToken } from 'src/engine/core-modules/mattermost/mattermost-provision-token.util';
import { UserEntity } from 'src/engine/core-modules/user/user.entity';

/**
 * Optionally creates Mattermost users ahead of first OIDC login when
 * a provisioning token and MATTERMOST_SITE_URL are set.
 * Uses Clerk user id as openid auth_data when CLERK_SECRET_KEY is set (matches Clerk OIDC `sub`).
 */
@Injectable()
export class MattermostProvisioningService {
  private readonly logger = new Logger(MattermostProvisioningService.name);

  constructor(
    private readonly mattermostBridgeService: MattermostBridgeService,
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
  ) {}

  /**
   * Same as workspace-member provisioning, keyed by CRM user id (e.g. first /chat session).
   */
  async ensureChatUserForTwentyUserId(userId: string): Promise<void> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: [...AUTH_CONTEXT_USER_SELECT_FIELDS],
    });

    if (!user) {
      return;
    }

    await this.ensureChatUserForWorkspaceMember(user as AuthContextUser);
  }

  async ensureChatUserForWorkspaceMember(user: AuthContextUser): Promise<void> {
    const baseUrl = process.env.MATTERMOST_SITE_URL?.trim();
    const token = resolveMattermostProvisionToken();

    if (!isDefined(baseUrl) || baseUrl.length === 0) {
      return;
    }
    if (!isDefined(token) || token.length === 0) {
      return;
    }

    const normalizedBase = baseUrl.replace(/\/$/, '');

    try {
      await this.ensureUser(normalizedBase, token, user);
      await this.mattermostBridgeService.ensureVaultPatForTwentyUser(user.id);
    } catch (error) {
      this.logger.warn(
        `Mattermost provisioning failed for ${user.email}: ${String(error)}`,
      );
    }
  }

  private async ensureUser(
    baseUrl: string,
    token: string,
    user: AuthContextUser,
  ): Promise<void> {
    const email = user.email.toLowerCase();
    const getRes = await fetch(
      `${baseUrl}/api/v4/users/email/${encodeURIComponent(email)}`,
      {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      },
    );

    if (getRes.ok) {
      return;
    }

    if (getRes.status !== 404) {
      const body = await getRes.text();
      throw new Error(
        `GET /users/email failed: ${getRes.status} ${body.slice(0, 200)}`,
      );
    }

    const clerkSub = await this.tryResolveClerkUserIdByEmail(email);

    const username = await this.allocateUsername(baseUrl, token, email, user.id);

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
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (createRes.ok || createRes.status === 409) {
      return;
    }

    const errBody = await createRes.text();
    this.logger.warn(
      `Mattermost POST /users ${createRes.status}: ${errBody.slice(0, 300)}`,
    );
  }

  private async tryResolveClerkUserIdByEmail(
    email: string,
  ): Promise<string | undefined> {
    const secretKey = process.env.CLERK_SECRET_KEY?.trim();
    if (!secretKey) {
      return undefined;
    }

    try {
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
    token: string,
    email: string,
    userId: string,
  ): Promise<string> {
    let candidate = this.deriveUsernameCandidate(email, userId);

    for (let i = 0; i < 8; i += 1) {
      const check = await fetch(
        `${baseUrl}/api/v4/users/username/${encodeURIComponent(candidate)}`,
        {
          method: 'GET',
          headers: { Authorization: `Bearer ${token}` },
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
