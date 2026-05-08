import { NextResponse } from "next/server";
import { callAiProvider, type AiProvider } from "../../lib/ai-provider";

type GenerateSequenceRequest = {
  aiProvider?: string;
  aiApiKey?: string;
  cycle?: string;
  niveau?: string;
  domaine?: string;
  sousDomaine?: string;
  item?: string;
  competence?: string;
  objectif?: string;
};

type Seance = {
  numero: number;
  phase: string;
  titre: string;
  objectif: string;
  activite: string;
  traceOuProduction: string;
};

type Sequence = {
  titre: string;
  intention: string;
  seances: Seance[];
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

function extraireJson(texte: string) {
  const debut = texte.indexOf("{");
  const fin = texte.lastIndexOf("}");

  if (debut === -1 || fin === -1) {
    throw new Error("La réponse de l'IA ne contient pas de JSON.");
  }

  return JSON.parse(texte.slice(debut, fin + 1)) as Sequence;
}

function sequenceValide(sequence: Sequence) {
  const phases = sequence.seances.map((seance) =>
    seance.phase
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
  );

  const phasesObligatoires = [
    "introduction",
    "entrainement",
    "approfondissement",
    "synthese",
    "evaluation"
  ];

  return (
    typeof sequence.titre === "string" &&
    typeof sequence.intention === "string" &&
    Array.isArray(sequence.seances) &&
    sequence.seances.length >= 5 &&
    phasesObligatoires.every((phase) =>
      phases.some((phaseGeneree) => phaseGeneree.includes(phase))
    )
  );
}

const SYSTEM_PROMPT =
  "Tu aides un enseignant à construire des séquences pédagogiques progressives, réalistes et adaptées au niveau des élèves. Tu respectes strictement le format JSON demandé.";

function buildPrompt(contexte: Omit<GenerateSequenceRequest, "aiProvider" | "aiApiKey">) {
  return `
Crée une progression de séquence pédagogique à partir de ces informations :
- Cycle : ${contexte.cycle}
- Niveau : ${contexte.niveau}
- Domaine : ${contexte.domaine}
- Sous-domaine : ${contexte.sousDomaine}
- Item : ${contexte.item}
- Compétence : ${contexte.competence}
- Objectif pédagogique : ${contexte.objectif}

Laisse l'IA déterminer le nombre de séances nécessaire.
La séquence doit toujours contenir au minimum une séance de chaque phase :
introduction, entraînement, approfondissement, synthèse, évaluation.

Réponds uniquement avec un JSON valide, sans Markdown, au format suivant :
{
  "titre": "Titre court de la séquence",
  "intention": "Phrase qui résume la logique de progression",
  "seances": [
    {
      "numero": 1,
      "phase": "introduction",
      "titre": "Titre de séance",
      "objectif": "Objectif de la séance",
      "activite": "Activité principale proposée",
      "traceOuProduction": "Trace, production ou observation attendue"
    }
  ]
}
`;
}

export async function POST(request: Request) {
  const body = (await request.json()) as GenerateSequenceRequest;
  const { aiProvider, aiApiKey, ...contexte } = body;

  if (
    !contexte.cycle ||
    !contexte.niveau ||
    !contexte.domaine ||
    !contexte.sousDomaine ||
    !contexte.item ||
    !contexte.competence ||
    !contexte.objectif
  ) {
    return NextResponse.json(
      { error: "Tous les éléments sélectionnés et l'objectif sont obligatoires." },
      { status: 400 }
    );
  }

  const prompt = buildPrompt(contexte);

  async function parseSequence(texte: string) {
    const sequence = extraireJson(texte);
    if (!sequenceValide(sequence)) {
      throw new Error(
        "La séquence générée est incomplète : elle doit contenir introduction, entraînement, approfondissement, synthèse et évaluation."
      );
    }
    return sequence;
  }

  if (aiProvider && aiApiKey && aiProvider !== "none") {
    try {
      const texte = await callAiProvider({
        provider: aiProvider as AiProvider,
        apiKey: aiApiKey,
        system: SYSTEM_PROMPT,
        prompt,
        maxTokens: 1800
      });

      const sequence = await parseSequence(texte);
      return NextResponse.json({ sequence });
    } catch (error) {
      return NextResponse.json(
        {
          error: error instanceof Error ? error.message : "Erreur lors de l'appel à l'IA.",
          details: ""
        },
        { status: error instanceof SyntaxError ? 502 : 500 }
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
      max_output_tokens: 1800,
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
  const texte = extraireTexteOpenAI(data);

  try {
    const sequence = await parseSequence(texte);
    return NextResponse.json({ sequence });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Impossible de lire la séquence générée.",
        details: texte
      },
      { status: 502 }
    );
  }
}
