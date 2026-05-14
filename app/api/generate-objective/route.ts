import { NextResponse } from "next/server";
import { callAiProvider, type AiProvider } from "../../lib/ai-provider";
import { buildReferencesContext } from "../../lib/references";

type GenerateObjectiveRequest = {
  aiProvider?: string;
  aiApiKey?: string;
  cycle?: string;
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

const SYSTEM_PROMPT = `<role>
Tu es SAGE, un assistant pédagogique expert du système éducatif français.
Tu formules des objectifs pédagogiques précis, conformes aux programmes de l'Éducation nationale.
</role>

<principes>
- L'objectif commence par un verbe d'action observable : identifier, comparer, produire, résoudre, distinguer, classer, construire, rédiger, expliquer…
- Il décrit ce que L'ÉLÈVE sera capable de faire — pas ce que l'enseignant va enseigner
- Il est réaliste pour une séquence de 4 à 6 séances
- Il est cohérent avec les programmes officiels en vigueur (BO 2024 cycles 2 et 3, BO 2021 cycle 1)
</principes>

<format_sortie>
Réponds uniquement avec l'objectif formulé : une phrase commençant par un verbe à l'infinitif, sans majuscule initiale, sans point final.
Exemple : "comparer des fractions ayant le même dénominateur en les plaçant sur une droite graduée"
</format_sortie>`;

export async function POST(request: Request) {
  const body = (await request.json()) as GenerateObjectiveRequest;
  const { aiProvider, aiApiKey, ...contexte } = body;

  if (!contexte.niveau || !contexte.domaine || !contexte.competence) {
    return NextResponse.json(
      { error: "Le niveau, le domaine et la compétence sont obligatoires." },
      { status: 400 }
    );
  }

  const referencesContext = buildReferencesContext(
    contexte.cycle ?? "",
    contexte.niveau ?? "",
    contexte.domaine ?? "",
    "objective"
  );

  const systemPromptWithRefs = referencesContext
    ? SYSTEM_PROMPT + referencesContext
    : SYSTEM_PROMPT;

  const prompt = `Formule un objectif pédagogique pour des élèves de ${contexte.niveau} en ${contexte.domaine}.
Compétence visée : ${contexte.competence}`;

  if (aiProvider && aiApiKey && aiProvider !== "none") {
    try {
      const objectif = await callAiProvider({
        provider: aiProvider as AiProvider,
        apiKey: aiApiKey,
        system: systemPromptWithRefs,
        prompt,
        maxTokens: 150
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
      instructions: systemPromptWithRefs,
      input: prompt,
      max_output_tokens: 150,
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
