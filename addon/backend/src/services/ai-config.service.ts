import { config } from "../config";
import type { AIConfig, AIProvider, RolePolicy } from "../types";
import { getSetting, setSetting, SETTINGS_KEYS } from "./settings.service";

export const AI_PROVIDERS: AIProvider[] = ["openai", "google", "anthropic", "groq", "xai"];
export const DEFAULT_AI_MODELS: Record<AIProvider, string> = {
  openai: "gpt-4o-mini",
  google: "gemini-2.0-flash",
  anthropic: "claude-3-5-haiku-20241022",
  groq: "llama-3.1-8b-instant",
  xai: "grok-3-mini",
};

const numberSetting = (key: string, fallback: number) => {
  const value = Number(getSetting(key));
  return Number.isFinite(value) && value > 0 ? value : fallback;
};

export function getAIConfig(): AIConfig {
  const providerValue = getSetting(SETTINGS_KEYS.aiProvider) ?? config.aiProvider;
  const provider = AI_PROVIDERS.includes(providerValue as AIProvider) ? providerValue as AIProvider : "openai";
  const fallbackProviders = (getSetting(SETTINGS_KEYS.aiFallbackProviders) ?? config.aiFallbackProviders.join(","))
    .split(",").map((item) => item.trim() as AIProvider)
    .filter((item) => AI_PROVIDERS.includes(item) && item !== provider);
  const rolePolicyValue = getSetting(SETTINGS_KEYS.aiDefaultRolePolicy) ?? "preferred";
  const defaultRolePolicy: RolePolicy = ["strict", "preferred", "free"].includes(rolePolicyValue)
    ? rolePolicyValue as RolePolicy : "preferred";

  return {
    provider,
    model: (getSetting(SETTINGS_KEYS.aiModel) ?? config.aiModel) || DEFAULT_AI_MODELS[provider],
    fallbackProviders,
    configuredProviders: AI_PROVIDERS.filter((item) => Boolean(config.aiApiKeys[item])),
    defaultPeriodCount: numberSetting(SETTINGS_KEYS.aiDefaultPeriodCount, 3),
    defaultMinutesPerPeriod: numberSetting(SETTINGS_KEYS.aiDefaultMinutesPerPeriod, 20),
    defaultPlayersOnField: numberSetting(SETTINGS_KEYS.aiDefaultPlayersOnField, 7),
    defaultRolePolicy,
  };
}

export function updateAIConfig(input: {
  provider?: AIProvider;
  model?: string;
  fallbackProviders?: AIProvider[];
  defaultPeriodCount?: number;
  defaultMinutesPerPeriod?: number;
  defaultPlayersOnField?: number;
  defaultRolePolicy?: RolePolicy;
}): AIConfig {
  if (input.provider !== undefined) setSetting(SETTINGS_KEYS.aiProvider, input.provider);
  if (input.model !== undefined) setSetting(SETTINGS_KEYS.aiModel, input.model.trim() || null);
  if (input.fallbackProviders !== undefined) setSetting(SETTINGS_KEYS.aiFallbackProviders, input.fallbackProviders.join(","));
  if (input.defaultPeriodCount !== undefined) setSetting(SETTINGS_KEYS.aiDefaultPeriodCount, String(input.defaultPeriodCount));
  if (input.defaultMinutesPerPeriod !== undefined) setSetting(SETTINGS_KEYS.aiDefaultMinutesPerPeriod, String(input.defaultMinutesPerPeriod));
  if (input.defaultPlayersOnField !== undefined) setSetting(SETTINGS_KEYS.aiDefaultPlayersOnField, String(input.defaultPlayersOnField));
  if (input.defaultRolePolicy !== undefined) setSetting(SETTINGS_KEYS.aiDefaultRolePolicy, input.defaultRolePolicy);
  return getAIConfig();
}

export function getAIKey(provider: AIProvider): string | undefined {
  return config.aiApiKeys[provider] || undefined;
}
