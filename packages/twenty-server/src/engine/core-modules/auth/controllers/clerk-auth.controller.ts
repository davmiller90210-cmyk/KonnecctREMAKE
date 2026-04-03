import {
  BadRequestException,
  Controller,
  HttpCode,
  HttpStatus,
  InternalServerErrorException,
  Logger,
  Post,
  Req,
  UnauthorizedException,
  UseFilters,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { type Request } from 'express';
import { createClerkClient, verifyToken } from '@clerk/backend';
import { In, IsNull, Repository } from 'typeorm';
import { isDefined } from 'twenty-shared/utils';
import {
  isWorkspaceActiveOrSuspended,
  WorkspaceActivationStatus,
} from 'twenty-shared/workspace';

import {
  KeyValuePairEntity,
  KeyValuePairType,
} from 'src/engine/core-modules/key-value-pair/key-value-pair.entity';
import {
  AuthException,
  AuthExceptionCode,
} from 'src/engine/core-modules/auth/auth.exception';
import { AuthRestApiExceptionFilter } from 'src/engine/core-modules/auth/filters/auth-rest-api-exception.filter';
import { type AuthContextUser } from 'src/engine/core-modules/auth/types/auth-context.type';
import { AuthService } from 'src/engine/core-modules/auth/services/auth.service';
import { SignInUpService } from 'src/engine/core-modules/auth/services/sign-in-up.service';
import { type UserEntity } from 'src/engine/core-modules/user/user.entity';
import { UserService } from 'src/engine/core-modules/user/services/user.service';
import { AuthProviderEnum } from 'src/engine/core-modules/workspace/types/workspace.type';
import { WorkspaceService } from 'src/engine/core-modules/workspace/services/workspace.service';
import { WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';
import { PermissionsException } from 'src/engine/metadata-modules/permissions/permissions.exception';

type ClerkTokenClaims = {
  sub?: string;
  org_id?: string;
  orgId?: string;
  email?: string;
  email_address?: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
};

@Controller('auth/clerk')
@UseFilters(AuthRestApiExceptionFilter)
export class ClerkAuthController {
  private readonly logger = new Logger(ClerkAuthController.name);

  constructor(
    private readonly authService: AuthService,
    private readonly signInUpService: SignInUpService,
    private readonly userService: UserService,
    private readonly workspaceService: WorkspaceService,
    @InjectRepository(KeyValuePairEntity)
    private readonly keyValuePairRepository: Repository<KeyValuePairEntity>,
    @InjectRepository(WorkspaceEntity)
    private readonly workspaceRepository: Repository<WorkspaceEntity>,
  ) {}

  @Post('exchange')
  @HttpCode(HttpStatus.OK)
  async exchange(@Req() req: Request) {
    const authHeader = req.headers.authorization;
    const secretKey = process.env.CLERK_SECRET_KEY;

    if (!secretKey) {
      throw new UnauthorizedException('Missing CLERK_SECRET_KEY');
    }

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing Authorization header');
    }

    const token = authHeader.split(' ')[1];

    let claims: ClerkTokenClaims;

    try {
      claims = (await verifyToken(token, { secretKey })) as ClerkTokenClaims;
    } catch (error) {
      this.logger.warn(`Failed to verify Clerk token: ${String(error)}`);
      throw new UnauthorizedException('Invalid Clerk session token');
    }

    const clerkUserId = claims.sub;
    const orgHeader = req.headers['x-clerk-org-id'];
    const orgFromHeader = Array.isArray(orgHeader) ? orgHeader[0] : orgHeader;
    const clerkOrgId =
      claims.org_id ?? claims.orgId ?? orgFromHeader?.toString().trim();

    if (!clerkUserId || !clerkOrgId) {
      throw new UnauthorizedException(
        'Konnecct requires a Clerk organization. Send X-Clerk-Org-Id or include org_id in the session JWT.',
      );
    }

    const clerkClient = createClerkClient({ secretKey });

    try {
      return await this.performClerkExchange({
        clerkClient,
        clerkUserId,
        clerkOrgId,
        claims,
      });
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      if (error instanceof AuthException) {
        throw error;
      }
      if (error instanceof PermissionsException) {
        throw new BadRequestException({
          message: error.message,
          code: error.code,
        });
      }
      if (error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error(
        `[KONNECCT-CLERK] exchange failed: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );

      throw new InternalServerErrorException(
        error instanceof Error ? error.message : 'Clerk exchange failed',
      );
    }
  }

  private async performClerkExchange({
    clerkClient,
    clerkUserId,
    clerkOrgId,
    claims,
  }: {
    clerkClient: ReturnType<typeof createClerkClient>;
    clerkUserId: string;
    clerkOrgId: string;
    claims: ClerkTokenClaims;
  }) {
    let clerkUser;

    try {
      clerkUser = await clerkClient.users.getUser(clerkUserId);
    } catch (error) {
      this.logger.warn(
        `[KONNECCT-CLERK] Clerk users.getUser failed: ${String(error)}`,
      );
      throw new UnauthorizedException('Could not load user from Clerk');
    }
    const primaryEmail = clerkUser.emailAddresses.find(
      (email) => email.id === clerkUser.primaryEmailAddressId,
    )?.emailAddress;

    const email = primaryEmail ?? claims.email ?? claims.email_address;

    if (!email) {
      throw new UnauthorizedException('Clerk user email is required');
    }

    const firstName = clerkUser.firstName ?? claims.given_name ?? '';
    const lastName = clerkUser.lastName ?? claims.family_name ?? '';
    const picture = clerkUser.imageUrl ?? claims.picture ?? '';

    const existingUser = await this.userService.findUserByEmailWithWorkspaces(
      email.toLowerCase(),
    );

    const orgKey = `konnecct:clerk:org:${clerkOrgId}:workspaceId`;
    const orgMapping = await this.keyValuePairRepository.findOne({
      where: {
        key: orgKey,
        type: KeyValuePairType.CONFIG_VARIABLE,
        userId: IsNull(),
      },
    });

    let workspace: WorkspaceEntity | null = null;
    let user = existingUser;

    const hadStoredOrgMapping = isDefined(orgMapping?.workspaceId);

    if (hadStoredOrgMapping) {
      workspace = await this.workspaceRepository.findOne({
        where: { id: orgMapping.workspaceId },
      });
    }

    // Legacy password/SSO users already have workspace memberships. Without this,
    // Clerk's first org would always call signUpOnNewWorkspace and strand them
    // on a second empty workspace instead of their real CRM.
    if (!workspace && isDefined(existingUser)) {
      workspace =
        await this.resolveWorkspaceFromLegacyUserMemberships(existingUser);
    }

    const userData = user
      ? { type: 'existingUser' as const, existingUser: user }
      : {
          type: 'newUserWithPicture' as const,
          newUserWithPicture: {
            email: email.toLowerCase(),
            firstName,
            lastName,
            picture,
            locale: 'en',
            isEmailVerified: true,
          },
        };

    let createdNewWorkspace = false;

    if (!workspace) {
      const created = await this.signInUpService.signUpOnNewWorkspace(userData);
      user = created.user;
      workspace = created.workspace;
      createdNewWorkspace = true;
    } else {
      user = await this.signInUpService.signInUpOnExistingWorkspace({
        workspace,
        userData,
      });
    }

    const shouldPersistOrgMapping =
      createdNewWorkspace ||
      !hadStoredOrgMapping ||
      orgMapping?.workspaceId !== workspace.id;

    if (shouldPersistOrgMapping) {
      await this.persistClerkOrgWorkspaceMapping({
        orgKey,
        clerkOrgId,
        workspace,
      });
    }

    const workspaceForActivation =
      (await this.workspaceRepository.findOne({
        where: { id: workspace.id },
      })) ?? workspace;

    if (
      workspaceForActivation.activationStatus ===
        WorkspaceActivationStatus.PENDING_CREATION ||
      workspaceForActivation.activationStatus ===
        WorkspaceActivationStatus.ONGOING_CREATION
    ) {
      let displayName = 'Konnecct';

      try {
        const org = await clerkClient.organizations.getOrganization({
          organizationId: clerkOrgId,
        });

        if (org?.name) {
          displayName = org.name;
        }
      } catch {
        this.logger.warn(
          `[KONNECCT-CLERK] Could not resolve Clerk org name for ${clerkOrgId}`,
        );
      }

      try {
        await this.workspaceService.activateWorkspace(
          user as AuthContextUser,
          workspaceForActivation,
          { displayName },
        );
      } catch (activationError) {
        const msg =
          activationError instanceof Error ? activationError.message : '';

        if (
          msg.includes('not pending creation') ||
          msg.includes('already being created')
        ) {
          this.logger.warn(
            `[KONNECCT-CLERK] activateWorkspace skipped (concurrent or already active): ${msg}`,
          );
        } else {
          throw activationError;
        }
      }
    }

    if (!user.isEmailVerified) {
      await this.userService.markEmailAsVerified(user.id);
    }

    const userForVerify = await this.userService.findUserByEmail(
      email.toLowerCase(),
    );

    if (!isDefined(userForVerify)) {
      throw new AuthException(
        'User not found after Clerk provisioning',
        AuthExceptionCode.USER_NOT_FOUND,
      );
    }

    const workspaceForTokens =
      (await this.workspaceRepository.findOne({
        where: { id: workspace.id },
      })) ?? workspace;

    const authTokens = await this.authService.verify(
      userForVerify.email,
      workspaceForTokens.id,
      AuthProviderEnum.Password,
    );

    return authTokens;
  }

  private pickPreferredWorkspaceForClerkLink(
    workspaces: WorkspaceEntity[],
  ): WorkspaceEntity | null {
    if (workspaces.length === 0) {
      return null;
    }

    const rank = (status: WorkspaceActivationStatus) => {
      if (status === WorkspaceActivationStatus.ACTIVE) return 0;
      if (status === WorkspaceActivationStatus.SUSPENDED) return 1;

      return 2;
    };

    return [...workspaces].sort((a, b) => {
      const byStatus = rank(a.activationStatus) - rank(b.activationStatus);

      if (byStatus !== 0) return byStatus;

      return a.createdAt.getTime() - b.createdAt.getTime();
    })[0];
  }

  private async resolveWorkspaceFromLegacyUserMemberships(
    userWithWorkspaces: UserEntity,
  ): Promise<WorkspaceEntity | null> {
    const workspaceIds = [
      ...new Set(
        (userWithWorkspaces.userWorkspaces ?? []).map((uw) => uw.workspaceId),
      ),
    ];

    if (workspaceIds.length === 0) {
      return null;
    }

    const workspaces = await this.workspaceRepository.find({
      where: { id: In(workspaceIds) },
    });

    const activeOrSuspended = workspaces.filter((w) =>
      isWorkspaceActiveOrSuspended(w),
    );

    const candidates =
      activeOrSuspended.length > 0 ? activeOrSuspended : workspaces;

    return this.pickPreferredWorkspaceForClerkLink(candidates);
  }

  private async persistClerkOrgWorkspaceMapping({
    orgKey,
    clerkOrgId,
    workspace,
  }: {
    orgKey: string;
    clerkOrgId: string;
    workspace: WorkspaceEntity;
  }) {
    const row = await this.keyValuePairRepository.findOne({
      where: {
        key: orgKey,
        type: KeyValuePairType.CONFIG_VARIABLE,
        userId: IsNull(),
      },
    });

    if (row) {
      row.workspaceId = workspace.id;
      row.value = {
        workspaceId: workspace.id,
        clerkOrgId,
      } as object;

      await this.keyValuePairRepository.save(row);

      return;
    }

    await this.keyValuePairRepository.save(
      this.keyValuePairRepository.create({
        key: orgKey,
        value: { workspaceId: workspace.id, clerkOrgId },
        userId: null,
        workspaceId: workspace.id,
        type: KeyValuePairType.CONFIG_VARIABLE,
      }),
    );
  }
}
