import { Test, type TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { FeatureFlagKey } from 'twenty-shared/types';

import { FeatureFlagEntity } from 'src/engine/core-modules/feature-flag/feature-flag.entity';
import {
  FeatureFlagException,
  FeatureFlagExceptionCode,
} from 'src/engine/core-modules/feature-flag/feature-flag.exception';
import { FeatureFlagService } from 'src/engine/core-modules/feature-flag/services/feature-flag.service';
import { featureFlagValidator } from 'src/engine/core-modules/feature-flag/validates/feature-flag.validate';
import { publicFeatureFlagValidator } from 'src/engine/core-modules/feature-flag/validates/is-public-feature-flag.validate';
import { WorkspaceCacheService } from 'src/engine/workspace-cache/services/workspace-cache.service';

jest.mock(
  'src/engine/core-modules/feature-flag/validates/is-public-feature-flag.validate',
);
jest.mock(
  'src/engine/core-modules/feature-flag/validates/feature-flag.validate',
);

describe('FeatureFlagService', () => {
  let service: FeatureFlagService;

  const mockFeatureFlagRepository = {
    findOneBy: jest.fn(),
    find: jest.fn(),
    upsert: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
  };

  const mockWorkspaceCacheService = {
    getOrRecompute: jest.fn(),
    invalidateAndRecompute: jest.fn(),
  };

  const workspaceId = 'workspace-id';
  const featureFlag = FeatureFlagKey.IS_AI_ENABLED;
  const optionalFeatureFlag = FeatureFlagKey.IS_UNIQUE_INDEXES_ENABLED;

  beforeEach(async () => {
    jest.clearAllMocks();

    (
      publicFeatureFlagValidator.assertIsPublicFeatureFlag as jest.Mock
    ).mockReset();
    (featureFlagValidator.assertIsFeatureFlagKey as jest.Mock).mockReset();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FeatureFlagService,
        {
          provide: getRepositoryToken(FeatureFlagEntity),
          useValue: mockFeatureFlagRepository,
        },
        {
          provide: WorkspaceCacheService,
          useValue: mockWorkspaceCacheService,
        },
      ],
    }).compile();

    service = module.get<FeatureFlagService>(FeatureFlagService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('isFeatureEnabled', () => {
    it('should return true when feature flag is enabled', async () => {
      // Prepare
      mockWorkspaceCacheService.getOrRecompute.mockResolvedValue({
        featureFlagsMap: {
          [featureFlag]: true,
        },
      });

      // Act
      const result = await service.isFeatureEnabled(featureFlag, workspaceId);

      // Assert
      expect(result).toBe(true);
      expect(mockWorkspaceCacheService.getOrRecompute).toHaveBeenCalledWith(
        workspaceId,
        ['featureFlagsMap'],
      );
    });

    it('should return false when feature flag is not found', async () => {
      // Prepare
      mockWorkspaceCacheService.getOrRecompute.mockResolvedValue({
        featureFlagsMap: {},
      });

      // Act
      const result = await service.isFeatureEnabled(
        optionalFeatureFlag,
        workspaceId,
      );

      // Assert
      expect(result).toBe(false);
    });

    it('should return false when feature flag value is false', async () => {
      // Prepare
      mockWorkspaceCacheService.getOrRecompute.mockResolvedValue({
        featureFlagsMap: {
          [optionalFeatureFlag]: false,
        },
      });

      // Act
      const result = await service.isFeatureEnabled(
        optionalFeatureFlag,
        workspaceId,
      );

      // Assert
      expect(result).toBe(false);
    });

    it('should always treat IS_AI_ENABLED as enabled', async () => {
      mockWorkspaceCacheService.getOrRecompute.mockResolvedValue({
        featureFlagsMap: {
          [FeatureFlagKey.IS_AI_ENABLED]: false,
        },
      });

      const result = await service.isFeatureEnabled(
        FeatureFlagKey.IS_AI_ENABLED,
        workspaceId,
      );

      expect(result).toBe(true);
    });
  });

  describe('getWorkspaceFeatureFlags', () => {
    it('should return all feature flags for a workspace', async () => {
      // Prepare
      mockWorkspaceCacheService.getOrRecompute.mockResolvedValue({
        featureFlagsMap: {
          [FeatureFlagKey.IS_AI_ENABLED]: false,
        },
      });
      const mockFeatureFlags = [
        { key: FeatureFlagKey.IS_AI_ENABLED, value: true },
      ];

      // Act
      const result = await service.getWorkspaceFeatureFlags(workspaceId);

      // Assert
      expect(result).toEqual(mockFeatureFlags);
      expect(mockWorkspaceCacheService.getOrRecompute).toHaveBeenCalledWith(
        workspaceId,
        ['featureFlagsMap'],
      );
    });
  });

  describe('getWorkspaceFeatureFlagsMap', () => {
    it('should return a map of feature flags for a workspace', async () => {
      mockWorkspaceCacheService.getOrRecompute.mockResolvedValue({
        featureFlagsMap: {
          [FeatureFlagKey.IS_AI_ENABLED]: false,
        },
      });

      const result = await service.getWorkspaceFeatureFlagsMap(workspaceId);

      expect(result).toEqual({
        [FeatureFlagKey.IS_AI_ENABLED]: true,
      });
    });
  });

  describe('enableFeatureFlags', () => {
    it('should enable multiple feature flags for a workspace', async () => {
      // Prepare
      const keys = [FeatureFlagKey.IS_AI_ENABLED];

      mockFeatureFlagRepository.upsert.mockResolvedValue({});
      mockWorkspaceCacheService.invalidateAndRecompute.mockResolvedValue(
        undefined,
      );

      // Act
      await service.enableFeatureFlags(keys, workspaceId);

      // Assert
      expect(mockFeatureFlagRepository.upsert).toHaveBeenCalledWith(
        keys.map((key) => ({ workspaceId, key, value: true })),
        {
          conflictPaths: ['workspaceId', 'key'],
          skipUpdateIfNoValuesChanged: true,
        },
      );
      expect(
        mockWorkspaceCacheService.invalidateAndRecompute,
      ).toHaveBeenCalledWith(workspaceId, ['featureFlagsMap']);
    });
  });

  describe('upsertWorkspaceFeatureFlag', () => {
    it('should upsert a feature flag for a workspace', async () => {
      // Prepare
      const value = true;
      const mockFeatureFlag = {
        key: featureFlag,
        value,
        workspaceId,
      };

      mockFeatureFlagRepository.save.mockResolvedValue(mockFeatureFlag);
      mockWorkspaceCacheService.invalidateAndRecompute.mockResolvedValue(
        undefined,
      );

      (
        featureFlagValidator.assertIsFeatureFlagKey as jest.Mock
      ).mockImplementation(() => true);

      // Act
      const result = await service.upsertWorkspaceFeatureFlag({
        workspaceId,
        featureFlag,
        value,
      });

      // Assert
      expect(result).toEqual(mockFeatureFlag);
      expect(mockFeatureFlagRepository.save).toHaveBeenCalledWith({
        key: FeatureFlagKey[featureFlag],
        value,
        workspaceId,
      });
      expect(
        mockWorkspaceCacheService.invalidateAndRecompute,
      ).toHaveBeenCalledWith(workspaceId, ['featureFlagsMap']);
    });

    it('should throw an exception when feature flag key is invalid', async () => {
      // Prepare
      const invalidFeatureFlag = 'INVALID_KEY' as FeatureFlagKey;
      const value = true;

      (
        featureFlagValidator.assertIsFeatureFlagKey as jest.Mock
      ).mockImplementation(() => {
        throw new FeatureFlagException(
          'Invalid feature flag key',
          FeatureFlagExceptionCode.INVALID_FEATURE_FLAG_KEY,
        );
      });

      // Act & Assert
      await expect(
        service.upsertWorkspaceFeatureFlag({
          workspaceId,
          featureFlag: invalidFeatureFlag,
          value,
        }),
      ).rejects.toThrow(
        new FeatureFlagException(
          'Invalid feature flag key',
          FeatureFlagExceptionCode.INVALID_FEATURE_FLAG_KEY,
        ),
      );
    });

    it('should throw when disabling IS_AI_ENABLED', async () => {
      (
        featureFlagValidator.assertIsFeatureFlagKey as jest.Mock
      ).mockImplementation(() => true);

      await expect(
        service.upsertWorkspaceFeatureFlag({
          workspaceId,
          featureFlag: FeatureFlagKey.IS_AI_ENABLED,
          value: false,
        }),
      ).rejects.toThrow('The AI feature cannot be disabled for this workspace.');
    });

    it('should throw an exception when non-public feature flag is used with shouldBePublic=true', async () => {
      // Prepare
      (
        publicFeatureFlagValidator.assertIsPublicFeatureFlag as jest.Mock
      ).mockImplementation(() => {
        throw new FeatureFlagException(
          'Invalid feature flag key, flag is not public',
          FeatureFlagExceptionCode.INVALID_FEATURE_FLAG_KEY,
        );
      });

      // Act & Assert
      await expect(
        service.upsertWorkspaceFeatureFlag({
          workspaceId,
          featureFlag,
          value: true,
          shouldBePublic: true,
        }),
      ).rejects.toThrow(
        new FeatureFlagException(
          'Invalid feature flag key, flag is not public',
          FeatureFlagExceptionCode.INVALID_FEATURE_FLAG_KEY,
        ),
      );
    });
  });
});
