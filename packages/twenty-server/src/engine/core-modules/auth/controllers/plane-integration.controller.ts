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
import { createClerkClient, verifyToken } from '@clerk/backend';
import { type Request } from 'express';
import * as jwt from 'jsonwebtoken';
import { IsNull, Repository } from 'typeorm';

import {
  KeyValuePairEntity,
  KeyValuePairType,
} from 'src/engine/core-modules/key-value-pair/key-value-pair.entity';
import { AuthRestApiExceptionFilter } from 'src/engine/core-modules/auth/filters/auth-rest-api-exception.filter';
import { WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';

type ClerkTokenClaims = {
  sub?: string;
  org_id?: string;
  orgId?: string;
};

/**
 * Konnecct ↔ Plane: Clerk session reconciliation and JWT bridge for a single Plane Django session.
 */
@Controller('integrations/plane')
@UseFilters(AuthRestApiExceptionFilter)
export class PlaneIntegrationController {
  private readonly logger = new Logger(PlaneIntegrationController.name);

  constructor(
    @InjectRepository(KeyValuePairEntity)
    private readonly keyValuePairRepository: Repository<KeyValuePairEntity>,
    @InjectRepository(WorkspaceEntity)
    private readonly workspaceRepository: Repository<WorkspaceEntity>,
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

  /**
   * Mints a short-lived HS256 JWT for POST /auth/konnecct-bridge/ on the Plane API (same host).
   */
  @Post('bridge-token')
  @HttpCode(HttpStatus.OK)
  async bridgeToken(@Req() req: Request) {
    const bridgeSecret = process.env.KONNECCT_BRIDGE_SECRET?.trim();

    if (!bridgeSecret) {
      throw new InternalServerErrorException(
        'KONNECCT_BRIDGE_SECRET is not configured on crm-server',
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

    const clerkUserId = claims.sub;
    const orgHeader = req.headers['x-clerk-org-id'];
    const orgFromHeader = Array.isArray(orgHeader) ? orgHeader[0] : orgHeader;
    const clerkOrgId =
      claims.org_id ?? claims.orgId ?? orgFromHeader?.toString().trim();

    if (!clerkUserId || !clerkOrgId) {
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

    if (!orgMapping?.workspaceId) {
      throw new BadRequestException(
        'No Clerk org → workspace mapping yet. Complete Konnecct sign-in once to provision the workspace.',
      );
    }

    const workspace = await this.workspaceRepository.findOne({
      where: { id: orgMapping.workspaceId },
    });

    if (!workspace) {
      throw new BadRequestException('Workspace not found for Clerk organization mapping');
    }

    const clerkClient = createClerkClient({ secretKey });

    let clerkUser;

    try {
      clerkUser = await clerkClient.users.getUser(clerkUserId);
    } catch (error) {
      this.logger.warn(`Plane bridge-token: getUser failed: ${String(error)}`);
      throw new UnauthorizedException('Could not load user from Clerk');
    }

    const primaryEmail = clerkUser.emailAddresses.find(
      (e) => e.id === clerkUser.primaryEmailAddressId,
    )?.emailAddress;

    if (!primaryEmail) {
      throw new BadRequestException('Clerk user has no primary email');
    }

    const workspaceSlug =
      process.env.PLANE_KONNECCT_WORKSPACE_SLUG?.trim() || workspace.subdomain;

    const bridgeToken = jwt.sign(
      {
        email: primaryEmail.toLowerCase(),
        first_name: clerkUser.firstName ?? '',
        last_name: clerkUser.lastName ?? '',
        clerk_user_id: clerkUserId,
        workspace_slug: workspaceSlug,
      },
      bridgeSecret,
      { expiresIn: '5m', algorithm: 'HS256' },
    );

    return { bridgeToken };
  }
}
