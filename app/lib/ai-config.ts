export type AiProvider = "openai" | "claude" | "gemini" | "mistral" | "none";

export type AiConfig = {
  provider: AiProvider;
  apiKey: string;
};

const AI_CONFIG_KEY = "sage-ai-config";

export function readAiConfig(): AiConfig | null {
  try {
    const value = localStorage.getItem(AI_CONFIG_KEY);
    if (!value) return null;
    return JSON.parse(value) as AiConfig;
  } catch {
    return null;
  }
}

export function writeAiConfig(config: AiConfig): void {
  localStorage.setItem(AI_CONFIG_KEY, JSON.stringify(config));
}

export function clearAiConfig(): void {
  localStorage.removeItem(AI_CONFIG_KEY);
}
