export type AiProvider = "openai" | "claude" | "gemini" | "mistral" | "none";

type AiCallParams = {
  provider: AiProvider;
  apiKey: string;
  system: string;
  prompt: string;
  maxTokens: number;
};

export async function callAiProvider(params: AiCallParams): Promise<string> {
  const { provider, apiKey, system, prompt, maxTokens } = params;

  switch (provider) {
    case "openai":
      return callOpenAI(apiKey, system, prompt, maxTokens);
    case "claude":
      return callClaude(apiKey, system, prompt, maxTokens);
    case "gemini":
      return callGemini(apiKey, system, prompt, maxTokens);
    case "mistral":
      return callMistral(apiKey, system, prompt, maxTokens);
    case "none":
      throw new Error(
        "L'assistant IA n'est pas configuré. Rendez-vous dans les Paramètres pour choisir un fournisseur."
      );
  }
}

async function callOpenAI(
  apiKey: string,
  system: string,
  prompt: string,
  maxTokens: number
): Promise<string> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: system },
        { role: "user", content: prompt }
      ],
      max_tokens: maxTokens
    })
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Erreur OpenAI (${response.status}) : ${details.slice(0, 300)}`);
  }

  type OpenAIChatResponse = {
    choices?: { message?: { content?: string } }[];
  };
  const data = (await response.json()) as OpenAIChatResponse;
  return data.choices?.[0]?.message?.content?.trim() ?? "";
}

async function callClaude(
  apiKey: string,
  system: string,
  prompt: string,
  maxTokens: number
): Promise<string> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      system,
      messages: [{ role: "user", content: prompt }],
      max_tokens: maxTokens
    })
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Erreur Claude (${response.status}) : ${details.slice(0, 300)}`);
  }

  type ClaudeResponse = {
    content?: { type?: string; text?: string }[];
  };
  const data = (await response.json()) as ClaudeResponse;
  return data.content?.find((c) => c.type === "text")?.text?.trim() ?? "";
}

async function callGemini(
  apiKey: string,
  system: string,
  prompt: string,
  maxTokens: number
): Promise<string> {
  const model = "gemini-1.5-flash";
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: maxTokens }
      })
    }
  );

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Erreur Gemini (${response.status}) : ${details.slice(0, 300)}`);
  }

  type GeminiResponse = {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const data = (await response.json()) as GeminiResponse;
  return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";
}

async function callMistral(
  apiKey: string,
  system: string,
  prompt: string,
  maxTokens: number
): Promise<string> {
  const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "mistral-small-latest",
      messages: [
        { role: "system", content: system },
        { role: "user", content: prompt }
      ],
      max_tokens: maxTokens
    })
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Erreur Mistral (${response.status}) : ${details.slice(0, 300)}`);
  }

  type MistralResponse = {
    choices?: { message?: { content?: string } }[];
  };
  const data = (await response.json()) as MistralResponse;
  return data.choices?.[0]?.message?.content?.trim() ?? "";
}
