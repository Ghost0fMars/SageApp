import { readUserData, writeUserData, userStorageKey } from "./user-storage";

export type AiProvider = "openai" | "claude" | "gemini" | "mistral" | "none";

export type AiConfig = {
  provider: AiProvider;
  apiKey: string;
};

const AI_CONFIG_KEY = "sage-ai-config";

export function readAiConfig(): AiConfig | null {
  const scoped = readUserData<AiConfig | null>(AI_CONFIG_KEY, null);
  if (scoped) return scoped;

  // Migration depuis l'ancienne clé globale vers le stockage utilisateur + cloud
  try {
    const legacy = localStorage.getItem(AI_CONFIG_KEY);
    if (legacy) {
      const parsed = JSON.parse(legacy) as AiConfig;
      writeAiConfig(parsed);
      return parsed;
    }
  } catch {
    // ignore
  }

  return null;
}

export function writeAiConfig(config: AiConfig): void {
  writeUserData(AI_CONFIG_KEY, config);
}

export function clearAiConfig(): void {
  localStorage.removeItem(userStorageKey(AI_CONFIG_KEY));
}
