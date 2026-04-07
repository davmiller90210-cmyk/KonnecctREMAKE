import { type AgentResponseSchema } from 'twenty-shared/ai';
import { z } from 'zod';
import { zodNonEmptyString } from '~/types/ZodNonEmptyString';

export const settingsAIAgentFormSchema = z.object({
  name: z.string().optional(),
  label: zodNonEmptyString,
  description: z.string().nullish(),
  icon: z.string().optional(),
  modelId: z.union([z.string().min(1, 'Model is required'), z.literal('auto')]),
  role: z.string().nullish(),
  prompt: zodNonEmptyString,
  isCustom: z.boolean().default(true),
  modelConfiguration: z
    .object({
      webSearch: z
        .object({
          enabled: z.boolean(),
          configuration: z.record(z.string(), z.unknown()).optional(),
        })
        .optional(),
      twitterSearch: z
        .object({
          enabled: z.boolean(),
          configuration: z.record(z.string(), z.unknown()).optional(),
        })
        .optional(),
      runtimeProfile: z
        .object({
          memoryScope: z.enum(['thread', 'record', 'workspace']).optional(),
          memoryPolicy: z.enum(['append', 'summarize', 'ephemeral']).optional(),
          memoryRetentionDays: z.number().int().positive().nullable().optional(),
          triggerMode: z
            .enum(['manual', 'event', 'schedule', 'hybrid'])
            .optional(),
          scheduleCron: z.string().nullable().optional(),
          approvalMode: z.enum(['none', 'destructive', 'always']).optional(),
          clarificationMode: z
            .enum(['low-confidence', 'permission-denied', 'always'])
            .optional(),
          guardrails: z.string().optional(),
          knowledgeSources: z.string().optional(),
        })
        .optional(),
      superagentProfile: z
        .object({
          lookId: z.string(),
          codename: z.string(),
          imageUrl: z.string(),
          palette: z.object({
            primary: z.string(),
            secondary: z.string(),
          }),
        })
        .optional(),
    })
    .optional(),
  responseFormat: z
    .object({
      type: z.enum(['text', 'json']),
      schema: z.custom<AgentResponseSchema>().optional(),
    })
    .optional(),
  evaluationInputs: z.array(z.string()).default([]),
});

export type SettingsAIAgentFormValues = z.infer<
  typeof settingsAIAgentFormSchema
>;
