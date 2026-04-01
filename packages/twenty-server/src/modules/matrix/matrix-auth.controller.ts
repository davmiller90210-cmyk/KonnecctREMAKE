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
import { Request } from 'express';
import * as jwt from 'jsonwebtoken';
import { createHash } from 'crypto';

import { MatrixAuthService } from 'src/modules/matrix/matrix-auth.service';

/**
 * MatrixAuthController
 *
 * Exposes a single authenticated endpoint that the CRM frontend calls
 * immediately after a successful CRM login to obtain a Matrix access token.
 *
 * This version uses MANUAL JWT verification to avoid dependency conflicts 
 * (UnknownDependenciesException) with the main AuthModule in the server.
 */
@Controller('matrix')
export class MatrixAuthController {
  private readonly logger = new Logger(MatrixAuthController.name);

  constructor(
    private readonly matrixAuthService: MatrixAuthService,
    private readonly configService: ConfigService,
  ) {}

  @Get('token')
  @HttpCode(HttpStatus.OK)
  async getMatrixToken(@Req() req: Request) {
    this.logger.log('Received Matrix token request');
    // 1. Extract the token from the Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or invalid Authorization header');
    }

    const token = authHeader.split(' ')[1];

    try {
      // 2. Decode the token (without verification) to get the workspaceId
      const decodedUnverified = jwt.decode(token) as any;
      if (!decodedUnverified || !decodedUnverified.workspaceId) {
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
      const verifiedPayload = jwt.verify(token, secret) as any;
      const workspaceMemberId = verifiedPayload.workspaceMemberId;

      if (!workspaceMemberId) {
        throw new NotFoundException(
          'No workspace member ID found in token. Cannot provision Matrix token.',
        );
      }

      // 5. Ensure the Matrix account exists (idempotent — safe to call every login)
      await this.matrixAuthService.provisionMatrixUser(workspaceMemberId);

      // 6. Issue and return the Matrix access token
      const tokenPayload =
        await this.matrixAuthService.getMatrixAccessToken(workspaceMemberId);

      return tokenPayload;
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        throw new UnauthorizedException('Invalid or expired CRM session token');
      }
      throw error;
    }
  }
}
