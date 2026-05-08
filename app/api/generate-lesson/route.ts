import { NextResponse } from "next/server";
import { callAiProvider, type AiProvider } from "../../lib/ai-provider";

type SeanceSequence = {
  numero?: number;
  phase?: string;
  titre?: string;
  objectif?: string;
  activite?: string;
  traceOuProduction?: string;
};

type GenerateLessonRequest = {
  aiProvider?: string;
  aiApiKey?: string;
  cycle?: string;
  niveau?: string;
  domaine?: string;
  sousDomaine?: string;
  item?: string;
  competence?: string;
  objectifSequence?: string;
  seance?: SeanceSequence;
};

type PhaseSeance = {
  titre: string;
  duree: string;
  organisation: string;
  roleEnseignant: string;
  consigne: string;
  activiteEleves: string;
  materiel: string;
};

type SeanceDetaillee = {
  titre: string;
  objectif: string;
  niveau: string;
  dureeTotale: string;
  materielGlobal: string;
  phases: PhaseSeance[];
  traceEcrite: string;
  vigilance: string;
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

  return JSON.parse(texte.slice(debut, fin + 1)) as SeanceDetaillee;
}

function seanceValide(seance: SeanceDetaillee) {
  return (
    typeof seance.titre === "string" &&
    typeof seance.objectif === "string" &&
    Array.isArray(seance.phases) &&
    seance.phases.length >= 3
  );
}

const SYSTEM_PROMPT =
  "Tu aides un enseignant à préparer des séances concrètes, progressives et adaptées au contexte de classe. Tu respectes strictement le format JSON demandé.";

function buildPrompt(contexte: Omit<GenerateLessonRequest, "aiProvider" | "aiApiKey">) {
  const s = contexte.seance!;
  return `
Prépare une séance détaillée à partir de ces informations :
- Cycle : ${contexte.cycle}
- Niveau : ${contexte.niveau}
- Domaine : ${contexte.domaine}
- Sous-domaine : ${contexte.sousDomaine}
- Item : ${contexte.item}
- Compétence : ${contexte.competence}
- Objectif de la séquence : ${contexte.objectifSequence}
- Séance à préparer : séance ${s.numero ?? ""}, phase "${s.phase ?? ""}", titre "${s.titre}"
- Objectif de cette séance : ${s.objectif}
- Activité prévue dans la progression : ${s.activite ?? ""}
- Trace ou production prévue : ${s.traceOuProduction ?? ""}

Construis un déroulement réaliste et directement utilisable par l'enseignant.
Le cheminement général à adapter est :
1. phase de lancement ;
2. phase de recherche, individuelle, en groupe ou en binôme selon ce qui est pertinent ;
3. phase de mise en commun avec validation d'une ou plusieurs méthodes ;
4. phase d'entraînement ou de consolidation de la ou des stratégies opératoires ;
5. phase d'institutionnalisation avec écriture d'une trace écrite.

Ce déroulement n'est pas canonique : adapte le nombre, le nom et le contenu des phases au type de séance.
Pour une séance d'évaluation, limite les phases de recherche ou d'entraînement si ce n'est pas pertinent.
Pour une séance d'introduction, donne plus de place à la situation de découverte.
Pour une séance de synthèse, donne plus de place à la verbalisation et à la trace.

Réponds uniquement avec un JSON valide, sans Markdown, au format suivant :
{
  "titre": "Titre de la séance",
  "objectif": "Objectif opérationnel de la séance",
  "niveau": "Niveau concerné",
  "dureeTotale": "Durée indicative",
  "materielGlobal": "Matériel nécessaire",
  "phases": [
    {
      "titre": "Nom de la phase",
      "duree": "Durée indicative",
      "organisation": "individuel, binôme, groupe, collectif...",
      "roleEnseignant": "Ce que fait l'enseignant",
      "consigne": "Consigne formulée pour les élèves",
      "activiteEleves": "Ce que font les élèves",
      "materiel": "Matériel utilisé dans cette phase"
    }
  ],
  "traceEcrite": "Proposition de trace écrite ou orale institutionnalisée",
  "vigilance": "Point d'attention pour l'enseignant"
}
`;
}

export async function POST(request: Request) {
  const body = (await request.json()) as GenerateLessonRequest;
  const { aiProvider, aiApiKey, ...contexte } = body;

  if (
    !contexte.cycle ||
    !contexte.niveau ||
    !contexte.domaine ||
    !contexte.sousDomaine ||
    !contexte.item ||
    !contexte.competence ||
    !contexte.objectifSequence ||
    !contexte.seance?.titre ||
    !contexte.seance?.objectif
  ) {
    return NextResponse.json(
      { error: "Les éléments de contexte, l'objectif et la séance choisie sont obligatoires." },
      { status: 400 }
    );
  }

  const prompt = buildPrompt(contexte);

  function parseSeance(texte: string) {
    const seance = extraireJson(texte);
    if (!seanceValide(seance)) {
      throw new Error("La séance générée est incomplète.");
    }
    return seance;
  }

  if (aiProvider && aiApiKey && aiProvider !== "none") {
    try {
      const texte = await callAiProvider({
        provider: aiProvider as AiProvider,
        apiKey: aiApiKey,
        system: SYSTEM_PROMPT,
        prompt,
        maxTokens: 2200
      });

      const seance = parseSeance(texte);
      return NextResponse.json({ seance });
    } catch (error) {
      return NextResponse.json(
        {
          error: error instanceof Error ? error.message : "Erreur lors de l'appel à l'IA.",
          details: ""
        },
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
      max_output_tokens: 2200,
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
    const seance = parseSeance(texte);
    return NextResponse.json({ seance });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Impossible de lire la séance générée.",
        details: texte
      },
      { status: 502 }
    );
  }
}
