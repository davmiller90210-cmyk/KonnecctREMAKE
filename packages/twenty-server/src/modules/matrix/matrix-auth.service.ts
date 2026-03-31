import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import * as crypto from 'crypto';

/**
 * MatrixAuthService
 *
 * Handles all server-side communication with the Synapse homeserver.
 * This service is the ONLY code that uses MATRIX_REGISTRATION_SHARED_SECRET.
 *
 * It is responsible for:
 * 1. Provisioning Matrix user accounts for new CRM workspace members
 * 2. Fetching Matrix access tokens (for passing to the CRM frontend)
 * 3. Creating and managing Matrix rooms mapped to CRM entities
 *
 * Matrix Username convention:
 *   @crm_<workspaceMemberId>:app.konnecct.com
 * This keeps CRM and Matrix identities cleanly linked without exposing
 * raw Matrix jargon to end users.
 */
@Injectable()
export class MatrixAuthService implements OnModuleInit {
  private readonly logger = new Logger(MatrixAuthService.name);
  private readonly synapseBaseUrl: string;
  private readonly registrationSharedSecret: string;
  private readonly serverName: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {
    this.synapseBaseUrl =
      this.configService.get<string>('SYNAPSE_BASE_URL') ||
      'http://synapse:8008';
    this.registrationSharedSecret =
      this.configService.get<string>('MATRIX_REGISTRATION_SHARED_SECRET') || '';
    this.serverName =
      this.configService.get<string>('SYNAPSE_SERVER_NAME') ||
      'app.konnecct.com';
  }

  onModuleInit() {
    if (!this.registrationSharedSecret) {
      this.logger.warn(
        'MATRIX_REGISTRATION_SHARED_SECRET is not set. Matrix provisioning will fail.',
      );
    }
  }

  /**
   * Converts a CRM WorkspaceMember ID into a stable Matrix user ID.
   * Format: @crm_<id>:app.konnecct.com
   * The "crm_" prefix ensures no collision with any manually-created Matrix accounts.
   */
  getMatrixUserId(workspaceMemberId: string): string {
    // Sanitize the ID for Matrix username requirements (lowercase, no hyphens)
    const sanitized = workspaceMemberId.toLowerCase().replace(/-/g, '');
    return `@crm_${sanitized}:${this.serverName}`;
  }

  /**
   * Extracts the localpart from a full Matrix user ID.
   * e.g. "@crm_abc:app.konnecct.com" -> "crm_abc"
   */
  private getLocalpart(workspaceMemberId: string): string {
    const sanitized = workspaceMemberId.toLowerCase().replace(/-/g, '');
    return `crm_${sanitized}`;
  }

  /**
   * Generates the HMAC-SHA1 registration nonce signature required by Synapse's
   * shared-secret registration endpoint (/_synapse/admin/v1/register).
   * This is a Synapse-specific registration protocol — the secret stays server-side.
   */
  private generateRegistrationMac(
    nonce: string,
    username: string,
    password: string,
    isAdmin: boolean,
  ): string {
    const isAdminStr = isAdmin ? 'admin' : 'notadmin';
    const hmac = crypto.createHmac('sha1', this.registrationSharedSecret);
    hmac.update(`${nonce}\0${username}\0${password}\0${isAdminStr}`);
    return hmac.digest('hex');
  }

  /**
   * Provisions a Matrix account for a CRM workspace member.
   * Idempotent: if the user already exists, returns without error.
   *
   * @param workspaceMemberId - The CRM workspace member UUID
   * @returns The Matrix user ID that was provisioned
   */
  async provisionMatrixUser(workspaceMemberId: string): Promise<string> {
    const localpart = this.getLocalpart(workspaceMemberId);
    const matrixUserId = this.getMatrixUserId(workspaceMemberId);

    try {
      // Step 1: Get a registration nonce from Synapse
      const nonceResponse = await firstValueFrom(
        this.httpService.get(
          `${this.synapseBaseUrl}/_synapse/admin/v1/register`,
        ),
      );
      const nonce: string = nonceResponse.data.nonce;

      // Step 2: Sign the registration request with the shared secret
      // A random password is generated — users never log in directly to Matrix.
      // They authenticate via the CRM which returns short-lived tokens.
      const password = crypto.randomBytes(32).toString('hex');
      const mac = this.generateRegistrationMac(nonce, localpart, password, false);

      // Step 3: Register the user
      await firstValueFrom(
        this.httpService.post(
          `${this.synapseBaseUrl}/_synapse/admin/v1/register`,
          {
            nonce,
            username: localpart,
            password,
            mac,
            admin: false,
            displayname: workspaceMemberId, // Will be overridden by the CRM display name updater
          },
        ),
      );

      this.logger.log(`Provisioned Matrix user: ${matrixUserId}`);
      return matrixUserId;
    } catch (error: any) {
      // M_USER_IN_USE means the user already exists — this is fine and expected
      if (error?.response?.data?.errcode === 'M_USER_IN_USE') {
        this.logger.debug(`Matrix user already exists: ${matrixUserId}`);
        return matrixUserId;
      }
      this.logger.error(
        `Failed to provision Matrix user ${matrixUserId}: ${error?.message}`,
      );
      throw error;
    }
  }

  /**
   * Issues a Matrix access token for an already-provisioned user.
   * This token is passed to the CRM frontend so matrix-js-sdk can initialize.
   *
   * Uses the Synapse admin API which requires an admin account.
   * We use a dedicated service account (@crm_admin:app.konnecct.com) for this.
   *
   * @param workspaceMemberId - The CRM workspace member UUID
   * @returns A Matrix access token valid for the session
   */
  async getMatrixAccessToken(workspaceMemberId: string): Promise<{
    accessToken: string;
    userId: string;
    deviceId: string;
    homeserverUrl: string;
  }> {
    const localpart = this.getLocalpart(workspaceMemberId);

    // Use the Synapse admin login-as endpoint to generate a token
    // This avoids the CRM needing to store Matrix passwords
    const adminToken = this.configService.get<string>('MATRIX_ADMIN_TOKEN');

    if (!adminToken) {
      throw new Error(
        'MATRIX_ADMIN_TOKEN is required to issue Matrix access tokens. ' +
          'Run the matrix-setup command to create an admin account.',
      );
    }

    const response = await firstValueFrom(
      this.httpService.post(
        `${this.synapseBaseUrl}/_synapse/admin/v1/users/@${localpart}:${this.serverName}/login`,
        {},
        { headers: { Authorization: `Bearer ${adminToken}` } },
      ),
    );

    return {
      accessToken: response.data.access_token,
      userId: this.getMatrixUserId(workspaceMemberId),
      deviceId: response.data.device_id || `crm_${Date.now()}`,
      homeserverUrl: `https://${this.serverName}`,
    };
  }
}
