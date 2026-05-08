import { NextResponse } from "next/server";
import { callAiProvider, type AiProvider } from "../../lib/ai-provider";

type GenerateObjectiveRequest = {
  aiProvider?: string;
  aiApiKey?: string;
  niveau?: string;
  domaine?: string;
  competence?: string;
};

type OpenAIOutputContent = {
  type?: string;
  text?: string;
};

type OpenAIOutputItem = {
  content?: OpenAIOutputContent[];
};

type OpenAIResponse = {
  output?: OpenAIOutputItem[];
};

function extraireTexteOpenAI(data: OpenAIResponse) {
  return (
    data.output
      ?.flatMap((item) => item.content ?? [])
      .find((content) => content.type === "output_text")
      ?.text?.trim() ?? ""
  );
}

const SYSTEM_PROMPT =
  "Tu aides un enseignant à formuler des objectifs pédagogiques clairs, précis et adaptés au niveau des élèves. Réponds uniquement avec l'objectif demandé.";

export async function POST(request: Request) {
  const body = (await request.json()) as GenerateObjectiveRequest;
  const { aiProvider, aiApiKey, ...contexte } = body;

  if (!contexte.niveau || !contexte.domaine || !contexte.competence) {
    return NextResponse.json(
      { error: "Le niveau, le domaine et la compétence sont obligatoires." },
      { status: 400 }
    );
  }

  const prompt = `Rédige un objectif pédagogique pour des ${contexte.niveau}. Domaine: ${contexte.domaine}. Compétence: ${contexte.competence}. Une phrase à l'infinitif.`;

  if (aiProvider && aiApiKey && aiProvider !== "none") {
    try {
      const objectif = await callAiProvider({
        provider: aiProvider as AiProvider,
        apiKey: aiApiKey,
        system: SYSTEM_PROMPT,
        prompt,
        maxTokens: 120
      });

      if (!objectif) {
        return NextResponse.json(
          { error: "L'IA n'a pas renvoyé de texte exploitable." },
          { status: 502 }
        );
      }

      return NextResponse.json({ objectif });
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Erreur lors de l'appel à l'IA." },
        { status: 500 }
      );
    }
  }

  if (aiProvider === "none") {
    return NextResponse.json(
      {
        error:
          "L'assistant IA n'est pas configuré. Rendez-vous dans les Paramètres pour choisir un fournisseur."
      },
      { status: 400 }
    );
  }

  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "Aucune IA configurée. Veuillez choisir un fournisseur IA dans les Paramètres." },
      { status: 500 }
    );
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
      instructions: SYSTEM_PROMPT,
      input: prompt,
      max_output_tokens: 120,
      reasoning: { effort: "none" }
    })
  });

  if (!response.ok) {
    const details = await response.text();
    return NextResponse.json(
      { error: "Erreur lors de l'appel à l'API OpenAI.", details },
      { status: response.status }
    );
  }

  const data = (await response.json()) as OpenAIResponse;
  const objectif = extraireTexteOpenAI(data);

  if (!objectif) {
    return NextResponse.json(
      { error: "L'API OpenAI n'a pas renvoyé de texte exploitable." },
      { status: 502 }
    );
  }

  return NextResponse.json({ objectif });
}
