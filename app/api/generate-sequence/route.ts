import { NextResponse } from "next/server";

type GenerateSequenceRequest = {
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
      .replace(/[\u0300-\u036f]/g, "")
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

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "La variable OPENAI_API_KEY est manquante dans .env.local." },
      { status: 500 }
    );
  }

  const contexte = (await request.json()) as GenerateSequenceRequest;

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

  const promptSequence = `
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

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL ?? "gpt-5.4-mini",
      instructions:
        "Tu aides un enseignant à construire des séquences pédagogiques progressives, réalistes et adaptées au niveau des élèves. Tu respectes strictement le format JSON demandé.",
      input: promptSequence,
      max_output_tokens: 1800,
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
  const texte = extraireTexteOpenAI(data);

  try {
    const sequence = extraireJson(texte);

    if (!sequenceValide(sequence)) {
      throw new Error(
        "La séquence générée est incomplète : elle doit contenir introduction, entraînement, approfondissement, synthèse et évaluation."
      );
    }

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
