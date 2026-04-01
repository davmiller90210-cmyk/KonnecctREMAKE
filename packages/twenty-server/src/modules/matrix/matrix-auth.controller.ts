import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  NotFoundException,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { createHash } from 'crypto';

import { MatrixAuthService } from './matrix-auth.service';

/**
 * MatrixAuthController
 *
 * Exposes a single authenticated endpoint that the CRM frontend calls
 * immediately after a successful CRM login to obtain a Matrix access token.
 *
 * This version uses manual JWT verification with NestJS JwtService to identify the user
 * without requiring the conflicting AuthModule dependencies.
 */
@Controller('matrix')
export class MatrixAuthController {
  private readonly logger = new Logger(MatrixAuthController.name);

  constructor(
    private readonly matrixAuthService: MatrixAuthService,
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
  ) {}

  @Get('token')
  @HttpCode(HttpStatus.OK)
  async getMatrixToken(@Req() req: Request) {
    this.logger.log('[KONNECCT-MATRIX] Received token request');

    // 1. Extract the token from the Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      this.logger.warn('[KONNECCT-MATRIX] Missing or invalid Authorization header');
      throw new UnauthorizedException('Missing or invalid Authorization header');
    }

    const token = authHeader.split(' ')[1];

    try {
      // 2. Decode the token (without verification) to get the workspaceId
      const decodedUnverified = this.jwtService.decode(token) as any;
      if (!decodedUnverified || !decodedUnverified.workspaceId) {
        this.logger.error('[KONNECCT-MATRIX] Missing workspaceId in token');
        throw new UnauthorizedException('Invalid token payload: missing workspaceId');
      }

      const workspaceId = decodedUnverified.workspaceId;
      const appSecret = this.configService.get<string>('APP_SECRET');

      if (!appSecret) {
        throw new Error('APP_SECRET is not set in the server environment');
      }

      // 3. Generate the workspace-specific secret used by Twenty for ACCESS tokens
      // Formula: sha256(APP_SECRET + workspaceId + "ACCESS")
      const secret = createHash('sha256')
        .update(`${appSecret}${workspaceId}ACCESS`)
        .digest('hex');

      // 4. Verify the token with the calculated secret
      const verifiedPayload = await this.jwtService.verifyAsync(token, { secret });
      const workspaceMemberId = verifiedPayload.workspaceMemberId;

      if (!workspaceMemberId) {
        this.logger.error(`[KONNECCT-MATRIX] No workspaceMemberId for workspace ${workspaceId}`);
        throw new NotFoundException(
          'No workspace member ID found in token. Cannot provision Matrix token.',
        );
      }

      this.logger.log(`[KONNECCT-MATRIX] Found workspaceMemberId: ${workspaceMemberId}. Provisioning Matrix...`);

      // 5. Ensure the Matrix account exists (idempotent — safe to call every login)
      await this.matrixAuthService.provisionMatrixUser(workspaceMemberId);

      // 6. Issue and return the Matrix access token
      const tokenPayload =
        await this.matrixAuthService.getMatrixAccessToken(workspaceMemberId);

      this.logger.log('[KONNECCT-MATRIX] Matrix token successfully issued');
      return tokenPayload;
    } catch (error) {
      this.logger.error(`[KONNECCT-MATRIX] Token provisioning failed: ${error.message}`);
      throw new UnauthorizedException('Invalid or expired CRM session token');
    }
  }

  @Get('health')
  health() {
    return { status: 'ok', message: 'Matrix controller is alive' };
  }
}
