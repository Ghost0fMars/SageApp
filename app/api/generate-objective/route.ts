import { NextResponse } from "next/server";

type GenerateObjectiveRequest = {
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

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "La variable OPENAI_API_KEY est manquante dans .env.local." },
      { status: 500 }
    );
  }

  const contexte = (await request.json()) as GenerateObjectiveRequest;

  if (!contexte.niveau || !contexte.domaine || !contexte.competence) {
    return NextResponse.json(
      { error: "Le niveau, le domaine et la compétence sont obligatoires." },
      { status: 400 }
    );
  }

  const promptObj = `Rédige un objectif pédagogique pour des ${contexte.niveau}. Domaine: ${contexte.domaine}. Compétence: ${contexte.competence}. Une phrase à l'infinitif.`;

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL ?? "gpt-5.4-mini",
      instructions:
        "Tu aides un enseignant à formuler des objectifs pédagogiques clairs, précis et adaptés au niveau des élèves. Réponds uniquement avec l'objectif demandé.",
      input: promptObj,
      max_output_tokens: 120,
      reasoning: {
        effort: "none"
      }
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
