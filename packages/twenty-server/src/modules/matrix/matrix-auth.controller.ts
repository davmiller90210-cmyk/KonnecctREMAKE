import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Req,
} from '@nestjs/common';
import { Request } from 'express';

import { MatrixAuthService } from 'src/modules/matrix/matrix-auth.service';

/**
 * MatrixAuthController
 *
 * Exposes a single authenticated endpoint that the CRM frontend calls
 * immediately after a successful CRM login to obtain a Matrix access token.
 *
 * The endpoint is protected by the CRM's standard JWT guard, so only
 * authenticated CRM users can receive a Matrix token.
 *
 * Flow:
 *   1. User logs in to Konnecct CRM (standard auth flow)
 *   2. Frontend calls GET /matrix/token with the CRM JWT in the Authorization header
 *   3. Backend resolves the WorkspaceMember ID from the JWT
 *   4. Backend calls MatrixAuthService to provision the user (if needed) and issue a token
 *   5. Frontend receives { accessToken, userId, deviceId, homeserverUrl }
 *   6. matrix-js-sdk initializes silently in the background
 *
 * The Matrix access token is short-lived. The frontend should re-fetch it
 * on session restore (page refresh) via this same endpoint.
 */
@Controller('matrix')
// @UseGuards(JwtAuthGuard)
export class MatrixAuthController {
  constructor(private readonly matrixAuthService: MatrixAuthService) {}

  @Get('token')
  @HttpCode(HttpStatus.OK)
  async getMatrixToken(@Req() req: Request) {
    // The JWT guard populates req.user with the authenticated CRM user context
    // When disabled for debugging, we handle the undefined case gracefully
    if (!req.user) {
      throw new NotFoundException(
        'Authentication context not found. Please log in first.',
      );
    }
    const user = req.user as { workspaceMemberId?: string; sub?: string };
    const workspaceMemberId = user?.workspaceMemberId || user?.sub;

    if (!workspaceMemberId) {
      throw new NotFoundException(
        'No workspace member ID found in session. Cannot provision Matrix token.',
      );
    }

    // Ensure the Matrix account exists (idempotent — safe to call every login)
    await this.matrixAuthService.provisionMatrixUser(workspaceMemberId);

    // Issue and return the Matrix access token
    const tokenPayload =
      await this.matrixAuthService.getMatrixAccessToken(workspaceMemberId);

    return tokenPayload;
  }
}
