import { randomUUID } from 'crypto';

import { msg } from '@lingui/core/macro';

import {
  AuthException,
  AuthExceptionCode,
} from 'src/engine/core-modules/auth/auth.exception';
import {
  type JwtPayload,
  JwtTokenTypeEnum,
} from 'src/engine/core-modules/auth/types/auth-context.type';
import { WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';

import { JwtAuthStrategy } from './jwt.auth.strategy';

describe('JwtAuthStrategy', () => {
  let strategy: JwtAuthStrategy;
  let workspaceRepository: any;
  let userWorkspaceRepository: any;
  let userRepository: any;
  let apiKeyRepository: any;
  let applicationRepository: any;
  let jwtWrapperService: any;
  let workspaceCacheService: any;
  let workspaceMemberRepository: any;

  const jwt = {
    sub: 'sub-default',
    jti: 'jti-default',
  };

  beforeEach(() => {
    workspaceRepository = {
      findOneBy: jest.fn(),
    };

    userRepository = {
      findOne: jest.fn(),
    };

    userWorkspaceRepository = {
      findOne: jest.fn(),
    };

    apiKeyRepository = {
      findOne: jest.fn(),
    };

    applicationRepository = {
      findOne: jest.fn(),
    };

    jwtWrapperService = {
      extractJwtFromRequest: jest.fn(() => () => 'token'),
    };

    workspaceMemberRepository = {
      findOne: jest.fn(),
    };
    workspaceMemberRepository.findOne.mockResolvedValue({
      id: 'workspace-member-id',
    });

    workspaceCacheService = {
      getOrRecompute: jest.fn(async (_workspaceId, _cacheKeys) => {
        return {
          flatWorkspaceMemberMaps: {
            byId: {
              'workspace-member-id': {
                id: 'workspace-member-id',
                userId: 'valid-user-id',
                workspaceId: 'workspace-id',
                createdAt: new Date(),
                updatedAt: new Date(),
                deletedAt: null,
              },
            },
            idByUserId: {
              'valid-user-id': 'workspace-member-id',
            },
          },
        };
      }),
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('API_KEY validation', () => {
    it('should throw AuthException if type is API_KEY and workspace is not found', async () => {
      const payload = {
        ...jwt,
        type: JwtTokenTypeEnum.API_KEY,
      };

      workspaceRepository.findOneBy.mockResolvedValue(null);

      strategy = new JwtAuthStrategy(
        jwtWrapperService,
        workspaceRepository,
        applicationRepository,
        userRepository,
        userWorkspaceRepository,
        apiKeyRepository,
        workspaceCacheService,
      );

      await expect(strategy.validate(payload as JwtPayload)).rejects.toThrow(
        new AuthException(
          'Workspace not found',
          AuthExceptionCode.WORKSPACE_NOT_FOUND,
        ),
      );
    });

    it('should throw AuthExceptionCode if type is API_KEY not found', async () => {
      const payload = {
        ...jwt,
        type: JwtTokenTypeEnum.API_KEY,
      };

      const mockWorkspace = new WorkspaceEntity();

      mockWorkspace.id = 'workspace-id';
      workspaceRepository.findOneBy.mockResolvedValue(mockWorkspace);

      apiKeyRepository.findOne.mockResolvedValue(null);

      strategy = new JwtAuthStrategy(
        jwtWrapperService,
        workspaceRepository,
        applicationRepository,
        userRepository,
        userWorkspaceRepository,
        apiKeyRepository,
        workspaceCacheService,
      );

      await expect(strategy.validate(payload as JwtPayload)).rejects.toThrow(
        new AuthException(
          'This API Key is revoked',
          AuthExceptionCode.FORBIDDEN_EXCEPTION,
        ),
      );
    });

    it('should throw AuthExceptionCode if API_KEY is revoked', async () => {
      const payload = {
        ...jwt,
        type: JwtTokenTypeEnum.API_KEY,
      };

      const mockWorkspace = new WorkspaceEntity();

      mockWorkspace.id = 'workspace-id';
      workspaceRepository.findOneBy.mockResolvedValue(mockWorkspace);

      apiKeyRepository.findOne.mockResolvedValue({
        id: 'api-key-id',
        revokedAt: new Date(),
      });

      strategy = new JwtAuthStrategy(
        jwtWrapperService,
        workspaceRepository,
        applicationRepository,
        userRepository,
        userWorkspaceRepository,
        apiKeyRepository,
        workspaceCacheService,
      );

      await expect(strategy.validate(payload as JwtPayload)).rejects.toThrow(
        new AuthException(
          'This API Key is revoked',
          AuthExceptionCode.FORBIDDEN_EXCEPTION,
        ),
      );
    });

    it('should be truthy if type is API_KEY and API_KEY is not revoked', async () => {
      const payload = {
        ...jwt,
        type: JwtTokenTypeEnum.API_KEY,
      };

      const mockWorkspace = new WorkspaceEntity();

      mockWorkspace.id = 'workspace-id';
      workspaceRepository.findOneBy.mockResolvedValue(mockWorkspace);

      apiKeyRepository.findOne.mockResolvedValue({
        id: 'api-key-id',
        revokedAt: null,
      });

      strategy = new JwtAuthStrategy(
        jwtWrapperService,
        workspaceRepository,
        applicationRepository,
        userRepository,
        userWorkspaceRepository,
        apiKeyRepository,
        workspaceCacheService,
      );

      const result = await strategy.validate(payload as JwtPayload);

      expect(result).toBeTruthy();
      expect(result.apiKey?.id).toBe('api-key-id');

      expect(apiKeyRepository.findOne).toHaveBeenCalledWith({
        where: {
          id: payload.jti,
          workspaceId: mockWorkspace.id,
        },
      });
    });
  });

  describe('ACCESS token validation', () => {
    it('should throw AuthExceptionCode if type is ACCESS, no jti, and user not found', async () => {
      const validUserId = 'valid-user-id';
      const validUserWorkspaceId = randomUUID();
      const validWorkspaceId = randomUUID();

      const payload = {
        sub: validUserId,
        type: JwtTokenTypeEnum.ACCESS,
        userWorkspaceId: validUserWorkspaceId,
        workspaceId: validWorkspaceId,
      };

      workspaceRepository.findOneBy.mockResolvedValue(new WorkspaceEntity());

      userRepository.findOne.mockResolvedValue(null);

      strategy = new JwtAuthStrategy(
        jwtWrapperService,
        workspaceRepository,
        applicationRepository,
        userRepository,
        userWorkspaceRepository,
        apiKeyRepository,
        workspaceCacheService,
      );

      await expect(strategy.validate(payload as JwtPayload)).rejects.toThrow(
        new AuthException(
          'User or user workspace not found',
          expect.any(String),
          {
            userFriendlyMessage: msg`User does not have access to this workspace`,
          },
        ),
      );

      try {
        await strategy.validate(payload as JwtPayload);
      } catch (e) {
        expect(e.code).toBe(AuthExceptionCode.USER_NOT_FOUND);
      }
    });

    it('should throw AuthExceptionCode if type is ACCESS, no jti, and userWorkspace not found', async () => {
      const validUserId = 'valid-user-id';
      const validUserWorkspaceId = randomUUID();
      const validWorkspaceId = randomUUID();

      const payload = {
        sub: validUserId,
        type: JwtTokenTypeEnum.ACCESS,
        userWorkspaceId: validUserWorkspaceId,
        workspaceId: validWorkspaceId,
      };

      workspaceRepository.findOneBy.mockResolvedValue(new WorkspaceEntity());

      userRepository.findOne.mockResolvedValue({ lastName: 'lastNameDefault' });

      userWorkspaceRepository.findOne.mockResolvedValue(null);

      strategy = new JwtAuthStrategy(
        jwtWrapperService,
        workspaceRepository,
        applicationRepository,
        userRepository,
        userWorkspaceRepository,
        apiKeyRepository,
        workspaceCacheService,
      );

      await expect(strategy.validate(payload as JwtPayload)).rejects.toThrow(
        new AuthException(
          'User or user workspace not found',
          expect.any(String),
          {
            userFriendlyMessage: msg`User does not have access to this workspace`,
          },
        ),
      );

      try {
        await strategy.validate(payload as JwtPayload);
      } catch (e) {
        expect(e.code).toBe(AuthExceptionCode.USER_NOT_FOUND);
      }
    });

    it('should not throw if type is ACCESS, no jti, and user and userWorkspace exist', async () => {
      const validUserId = 'valid-user-id';
      const validUserWorkspaceId = randomUUID();
      const validWorkspaceId = randomUUID();

      const payload = {
        sub: validUserId,
        type: JwtTokenTypeEnum.ACCESS,
        userWorkspaceId: validUserWorkspaceId,
        workspaceId: validWorkspaceId,
      };

      workspaceRepository.findOneBy.mockResolvedValue(new WorkspaceEntity());

      userRepository.findOne.mockResolvedValue({
        id: validUserId,
        lastName: 'lastNameDefault',
      });

      userWorkspaceRepository.findOne.mockResolvedValue({
        id: validUserWorkspaceId,
        user: { id: validUserId, lastName: 'lastNameDefault' },
        workspace: { id: validWorkspaceId },
      });

      strategy = new JwtAuthStrategy(
        jwtWrapperService,
        workspaceRepository,
        applicationRepository,
        userRepository,
        userWorkspaceRepository,
        apiKeyRepository,
        workspaceCacheService,
      );

      const user = await strategy.validate(payload as JwtPayload);

      expect(user.user?.lastName).toBe('lastNameDefault');
      expect(user.userWorkspaceId).toBe(validUserWorkspaceId);
    });
  });

  describe('APPLICATION_ACCESS token validation', () => {
    it('should throw AuthExceptionCode if type is APPLICATION_ACCESS, and application not found', async () => {
      const validApplicationId = randomUUID();
      const validWorkspaceId = randomUUID();

      const payload = {
        sub: validApplicationId,
        type: JwtTokenTypeEnum.APPLICATION_ACCESS,
        applicationId: validApplicationId,
        workspaceId: validWorkspaceId,
      };

      workspaceRepository.findOneBy.mockResolvedValue(new WorkspaceEntity());

      applicationRepository.findOne.mockResolvedValue(null);

      strategy = new JwtAuthStrategy(
        jwtWrapperService,
        workspaceRepository,
        applicationRepository,
        userRepository,
        userWorkspaceRepository,
        apiKeyRepository,
        workspaceCacheService,
      );

      await expect(strategy.validate(payload as JwtPayload)).rejects.toThrow(
        new AuthException('Application not found', expect.any(String), {
          userFriendlyMessage: msg`Application not found.`,
        }),
      );

      try {
        await strategy.validate(payload as JwtPayload);
      } catch (e) {
        expect(e.code).toBe(AuthExceptionCode.APPLICATION_NOT_FOUND);
      }
    });
  });

  describe('Impersonation validation', () => {
    it('rejects access tokens with impersonation claims', async () => {
      const validUserId = 'valid-user-id';
      const validUserWorkspaceId = randomUUID();
      const validWorkspaceId = randomUUID();

      const payload = {
        sub: validUserId,
        type: JwtTokenTypeEnum.ACCESS,
        userWorkspaceId: validUserWorkspaceId,
        workspaceId: validWorkspaceId,
        isImpersonating: true,
        impersonatorUserWorkspaceId: randomUUID(),
        impersonatedUserWorkspaceId: validUserWorkspaceId,
      };

      const mockWorkspace = new WorkspaceEntity();
      mockWorkspace.id = validWorkspaceId;
      workspaceRepository.findOneBy.mockResolvedValue(mockWorkspace);

      strategy = new JwtAuthStrategy(
        jwtWrapperService,
        workspaceRepository,
        applicationRepository,
        userRepository,
        userWorkspaceRepository,
        apiKeyRepository,
        workspaceCacheService,
      );

      await expect(strategy.validate(payload as JwtPayload)).rejects.toThrow(
        new AuthException(
          'Impersonation sessions are no longer supported; sign in again with your identity provider.',
          AuthExceptionCode.FORBIDDEN_EXCEPTION,
        ),
      );
    });
  });

});