import {
  Controller,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { type Request } from 'express';
import { createClerkClient, verifyToken } from '@clerk/backend';
import { Repository } from 'typeorm';
import { isDefined } from 'twenty-shared/utils';

import {
  KeyValuePairEntity,
  KeyValuePairType,
} from 'src/engine/core-modules/key-value-pair/key-value-pair.entity';
import { UserService } from 'src/engine/core-modules/user/services/user.service';
import { WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';
import { AuthService } from 'src/engine/core-modules/auth/services/auth.service';
import { SignInUpService } from 'src/engine/core-modules/auth/services/sign-in-up.service';
import { AuthProviderEnum } from 'src/engine/core-modules/workspace/types/workspace.type';

type ClerkTokenClaims = {
  sub?: string;
  org_id?: string;
  email?: string;
  email_address?: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
};

@Controller('auth/clerk')
export class ClerkAuthController {
  private readonly logger = new Logger(ClerkAuthController.name);

  constructor(
    private readonly authService: AuthService,
    private readonly signInUpService: SignInUpService,
    private readonly userService: UserService,
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
    const clerkOrgId = claims.org_id;

    if (!clerkUserId || !clerkOrgId) {
      throw new UnauthorizedException('Konnecct requires a Clerk org_id');
    }

    const clerkClient = createClerkClient({ secretKey });
    const clerkUser = await clerkClient.users.getUser(clerkUserId);
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
      },
    });

    let workspace: WorkspaceEntity | null = null;
    let user = existingUser;

    if (isDefined(orgMapping?.workspaceId)) {
      workspace = await this.workspaceRepository.findOne({
        where: { id: orgMapping.workspaceId },
      });
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

    if (!workspace) {
      const created = await this.signInUpService.signUpOnNewWorkspace(userData);
      user = created.user;
      workspace = created.workspace;

      await this.keyValuePairRepository.save(
        this.keyValuePairRepository.create({
          key: orgKey,
          value: { workspaceId: workspace.id, clerkOrgId },
          userId: null,
          workspaceId: workspace.id,
          type: KeyValuePairType.CONFIG_VARIABLE,
        }),
      );
    } else {
      user = await this.signInUpService.signInUpOnExistingWorkspace({
        workspace,
        userData,
      });
    }

    if (!user.isEmailVerified) {
      await this.userService.markEmailAsVerified(user.id);
    }

    const authTokens = await this.authService.verify(
      user.email,
      workspace.id,
      AuthProviderEnum.SSO,
    );

    return authTokens;
  }
}
