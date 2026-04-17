// TODO: derive default model preferences dynamically from the catalog
// instead of hardcoding model IDs that become stale as models evolve
import { type AiModelPreferences } from 'src/engine/metadata-modules/ai/ai-models/types/ai-model-preferences.type';

// Konnecct uses Google/Gemini exclusively — all other providers are excluded.
const DEFAULT_FAST_MODELS = [
  'google/gemini-2.0-flash',
  'google/gemini-1.5-flash',
  'google/gemini-2.5-flash-preview',
];

const DEFAULT_SMART_MODELS = [
  'google/gemini-2.5-pro-preview',
  'google/gemini-1.5-pro',
  'google/gemini-2.0-pro',
];

const DEFAULT_RECOMMENDED_MODELS = [
  'google/gemini-2.5-pro-preview',
  'google/gemini-1.5-pro',
  'google/gemini-2.0-flash',
  'google/gemini-1.5-flash',
];

export const loadDefaultModelPreferences = (): AiModelPreferences => {
  return {
    disabledModels: [],
    recommendedModels: DEFAULT_RECOMMENDED_MODELS,
    defaultFastModels: DEFAULT_FAST_MODELS,
    defaultSmartModels: DEFAULT_SMART_MODELS,
  };
};
