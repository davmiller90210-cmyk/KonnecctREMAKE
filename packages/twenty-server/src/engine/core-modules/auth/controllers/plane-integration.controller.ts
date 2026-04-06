import {
  Controller,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  Req,
  UnauthorizedException,
  UseFilters,
} from '@nestjs/common';
import { type Request } from 'express';
import { verifyToken } from '@clerk/backend';

import { AuthRestApiExceptionFilter } from 'src/engine/core-modules/auth/filters/auth-rest-api-exception.filter';

type ClerkTokenClaims = {
  sub?: string;
  org_id?: string;
  orgId?: string;
};

/**
 * Called after Clerk session exchange so the server can reconcile Konnecct users with Plane.
 * Full 1:1 automation depends on your Plane edition (REST/API keys, OIDC, or email invites).
 */
@Controller('integrations/plane')
@UseFilters(AuthRestApiExceptionFilter)
export class PlaneIntegrationController {
  private readonly logger = new Logger(PlaneIntegrationController.name);

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
}
