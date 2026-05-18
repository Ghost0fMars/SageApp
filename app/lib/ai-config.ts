import { readUserData, writeUserData, userStorageKey } from "./user-storage";

export type AiProvider = "openai" | "claude" | "gemini" | "mistral" | "none";

export type AiConfig = {
  provider: AiProvider;
  apiKey: string;
};

const AI_CONFIG_KEY = "sage-ai-config";

export function readAiConfig(): AiConfig | null {
  return readUserData<AiConfig | null>(AI_CONFIG_KEY, null, AI_CONFIG_KEY);
}

export function writeAiConfig(config: AiConfig): void {
  writeUserData(AI_CONFIG_KEY, config);
}

export function clearAiConfig(): void {
  localStorage.removeItem(userStorageKey(AI_CONFIG_KEY));
}
