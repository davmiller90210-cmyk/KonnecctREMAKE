import {
  Controller,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  Req,
  UnauthorizedException,
  UseFilters,
  HttpException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createClerkClient, verifyToken } from '@clerk/backend';
import { type Request } from 'express';
import * as jwt from 'jsonwebtoken';
import { IsNull, Repository } from 'typeorm';
import { isDefined } from 'twenty-shared/utils';

import {
  KeyValuePairEntity,
  KeyValuePairType,
} from 'src/engine/core-modules/key-value-pair/key-value-pair.entity';
import { AuthRestApiExceptionFilter } from 'src/engine/core-modules/auth/filters/auth-rest-api-exception.filter';
import { UserEntity } from 'src/engine/core-modules/user/user.entity';
import { UserWorkspaceEntity } from 'src/engine/core-modules/user-workspace/user-workspace.entity';
import { WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';
import { UserRoleService } from 'src/engine/metadata-modules/user-role/user-role.service';

type ClerkTokenClaims = {
  sub?: string;
  org_id?: string;
  orgId?: string;
  email?: string;
  email_address?: string;
};

const PLANE_ROLE_ADMIN = 20;
const PLANE_ROLE_MEMBER = 15;
const PLANE_RESERVED_WORKSPACE_SLUGS = new Set([
  'app',
  'api',
  'auth',
  'admin',
  'projects',
  'spaces',
  'live',
  'static',
  'uploads',
  'god-mode',
]);

const toSafePlaneWorkspaceSlug = (raw: string, fallbackSeed: string) => {
  const normalized = raw
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);

  if (
    normalized.length >= 2 &&
    !PLANE_RESERVED_WORKSPACE_SLUGS.has(normalized)
  ) {
    return normalized;
  }

  return `ws-${fallbackSeed.replace(/[^a-z0-9]/gi, '').slice(0, 12).toLowerCase()}`;
};

@Controller('integrations/plane')
@UseFilters(AuthRestApiExceptionFilter)
export class PlaneIntegrationController {
  private readonly logger = new Logger(PlaneIntegrationController.name);

  constructor(
    @InjectRepository(KeyValuePairEntity)
    private readonly keyValuePairRepository: Repository<KeyValuePairEntity>,
    @InjectRepository(WorkspaceEntity)
    private readonly workspaceRepository: Repository<WorkspaceEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    @InjectRepository(UserWorkspaceEntity)
    private readonly userWorkspaceRepository: Repository<UserWorkspaceEntity>,
    private readonly userRoleService: UserRoleService,
  ) {}

  @Post('sync')
  @HttpCode(HttpStatus.OK)
  async sync(@Req() req: Request) {
    const secretKey = process.env.CLERK_SECRET_KEY;

    if (!secretKey) {
      throw new UnauthorizedException('Missing CLERK_SECRET_KEY');
    }

    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing Authorization header');
    }

    const token = authHeader.split(' ')[1];
    let claims: ClerkTokenClaims;

    try {
      claims = (await verifyToken(token, { secretKey })) as ClerkTokenClaims;
    } catch (error) {
      this.logger.warn(`Plane sync: invalid Clerk token: ${String(error)}`);
      throw new UnauthorizedException('Invalid Clerk session token');
    }

    const orgHeader = req.headers['x-clerk-org-id'];
    const orgFromHeader = Array.isArray(orgHeader) ? orgHeader[0] : orgHeader;
    const clerkOrgId =
      claims.org_id ?? claims.orgId ?? orgFromHeader?.toString().trim();

    if (!claims.sub || !clerkOrgId) {
      throw new UnauthorizedException(
        'Plane sync requires a Clerk organization (X-Clerk-Org-Id or org_id in JWT).',
      );
    }

    const planeWebUrl = process.env.PLANE_WEB_URL ?? '';

    this.logger.debug(
      `Plane sync ok for Clerk user ${claims.sub} (org ${clerkOrgId})`,
    );

    return {
      ok: true,
      planeWebUrl,
    };
  }

  @Post('bridge-token')
  @HttpCode(HttpStatus.OK)
  async bridgeToken(@Req() req: Request) {
    const bridgeSecret =
      process.env.KONNECCT_BRIDGE_SECRET?.trim() ||
      process.env.PLANE_KONNECCT_BRIDGE_SECRET?.trim();

    if (!bridgeSecret) {
      throw new HttpException(
        'KONNECCT_BRIDGE_SECRET is not configured on crm-server',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    const secretKey = process.env.CLERK_SECRET_KEY;

    if (!secretKey) {
      throw new UnauthorizedException('Missing CLERK_SECRET_KEY');
    }

    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing Authorization header');
    }

    const token = authHeader.split(' ')[1];
    let claims: ClerkTokenClaims;

    try {
      claims = (await verifyToken(token, { secretKey })) as ClerkTokenClaims;
    } catch (error) {
      this.logger.warn(`Plane bridge-token: invalid Clerk token: ${String(error)}`);
      throw new UnauthorizedException('Invalid Clerk session token');
    }

    const orgHeader = req.headers['x-clerk-org-id'];
    const orgFromHeader = Array.isArray(orgHeader) ? orgHeader[0] : orgHeader;
    const clerkOrgId =
      claims.org_id ?? claims.orgId ?? orgFromHeader?.toString().trim();

    if (!claims.sub || !clerkOrgId) {
      throw new UnauthorizedException(
        'Plane bridge requires a Clerk organization (X-Clerk-Org-Id or org_id in JWT).',
      );
    }

    const orgKey = `konnecct:clerk:org:${clerkOrgId}:workspaceId`;
    const orgMapping = await this.keyValuePairRepository.findOne({
      where: {
        key: orgKey,
        type: KeyValuePairType.CONFIG_VARIABLE,
        userId: IsNull(),
      },
    });

    if (!isDefined(orgMapping?.workspaceId)) {
      throw new UnauthorizedException(
        'No Twenty workspace mapped for this Clerk organization yet. Complete sign-in first.',
      );
    }

    const workspace = await this.workspaceRepository.findOne({
      where: { id: orgMapping.workspaceId },
    });

    if (!workspace) {
      throw new UnauthorizedException('Mapped workspace not found');
    }

    const clerkClient = createClerkClient({ secretKey });

    let clerkUser;

    try {
      clerkUser = await clerkClient.users.getUser(claims.sub);
    } catch (error) {
      this.logger.warn(`Plane bridge-token: getUser failed: ${String(error)}`);
      throw new UnauthorizedException('Could not load user from Clerk');
    }

    const primaryEmail = clerkUser.emailAddresses.find(
      (e) => e.id === clerkUser.primaryEmailAddressId,
    )?.emailAddress;

    const email =
      primaryEmail ?? claims.email ?? claims.email_address ?? undefined;

    if (!email) {
      throw new UnauthorizedException('Clerk user email is required');
    }

    const user = await this.userRepository.findOne({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      throw new UnauthorizedException('User not found in Twenty workspace');
    }

    const userWorkspace = await this.userWorkspaceRepository.findOne({
      where: {
        userId: user.id,
        workspaceId: workspace.id,
      },
    });

    let workspaceRole = PLANE_ROLE_MEMBER;

    if (isDefined(userWorkspace)) {
      const rolesMap = await this.userRoleService.getRolesByUserWorkspaces({
        userWorkspaceIds: [userWorkspace.id],
        workspaceId: workspace.id,
      });
      const roles = rolesMap.get(userWorkspace.id) ?? [];
      const primaryRole = roles[0];

      if (isDefined(primaryRole) && primaryRole.canUpdateAllSettings) {
        workspaceRole = PLANE_ROLE_ADMIN;
      }
    }

    const overrideSlug = process.env.PLANE_KONNECCT_WORKSPACE_SLUG?.trim();
    const workspaceSlug = toSafePlaneWorkspaceSlug(
      overrideSlug || workspace.subdomain,
      workspace.id,
    );
    const workspaceName =
      workspace.displayName?.trim() || workspace.subdomain || 'Workspace';

    const bridgeToken = jwt.sign(
      {
        email: email.toLowerCase(),
        first_name: clerkUser.firstName ?? '',
        last_name: clerkUser.lastName ?? '',
        clerk_user_id: claims.sub,
        workspace_slug: workspaceSlug,
        workspace_name: workspaceName,
        workspace_role: workspaceRole,
      },
      bridgeSecret,
      { expiresIn: '5m', algorithm: 'HS256' as const },
    );

    return { bridgeToken, workspaceSlug };
  }
}
