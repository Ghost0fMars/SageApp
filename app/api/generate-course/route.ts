import { NextResponse } from "next/server";
import { lireObjetJsonIa } from "../../lib/ai-json";
import { callAiProvider, type AiProvider } from "../../lib/ai-provider";
import { buildReferencesContext } from "../../lib/references";
import { normaliserEtValiderCours, type CoursPresentation } from "../../lib/course-types";

type PhaseSeanceDetaillee = {
  nom: string;
  duree_minutes: number;
  disposition_classe: string;
  role_enseignant: string;
  consigne: string;
  role_eleves: string;
  hors_champ: string | null;
  erreurs_anticipees: string[];
  relances: string[];
  materiel: string;
};

type SeanceDetaillee = {
  titre: string;
  objectif: string;
  niveau: string;
  duree_minutes: number;
  materiel: string[];
  phases: PhaseSeanceDetaillee[];
  trace_ecrite: string;
  vigilance: string;
};

type GenerateCourseRequest = {
  aiProvider?: string;
  aiApiKey?: string;
  cycle?: string;
  niveau?: string;
  domaine?: string;
  sousDomaine?: string;
  item?: string;
  competence?: string;
  sequenceTitle?: string;
  seanceNumero?: number;
  lesson?: SeanceDetaillee;
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
Tu es SAGE, un assistant pédagogique expert en conception de supports de cours projetables.
Tu transformes une fiche de séance enseignant en présentation claire à diffuser en classe.
</role>

<principes>
- Le cours est un support projetable pour l'enseignant, pas une fiche de préparation.
- Chaque slide doit être lisible au tableau : peu de texte, phrases courtes, mots clés.
- Les notes_enseignant contiennent ce que l'enseignant doit dire, faire ou éviter de révéler.
- Respecte la progression de découverte de la fiche séance.
- Prévois des interactions visibles : question, observation, comparaison, mise en commun, entraînement.
</principes>

<blocs>
Chaque diapositive contient une liste ordonnée de "blocs" de contenu (1 à 3 blocs maximum). Types
disponibles :
- "text" : liste de points courts projetables (équivalent de l'ancien contenu).
- "chart" : graphique de données chiffrées (barres, courbes ou camembert) — uniquement si la phase
  manipule des mesures, comptages, ou données comparables (jamais pour illustrer une idée qualitative).
- "schema" : diagramme structuré, un seul des variants suivants :
  - "frise" : évènements datés sur une ligne du temps (2 à 8 évènements).
  - "cycle" : 3 à 8 étapes qui se répètent en boucle (cycle de l'eau, cycle de vie...).
  - "etapes" : 2 à 8 étapes d'une démarche ou d'une procédure, non cyclique.
  - "legende" : figure à légender avec des points numérotés (jamais d'image — l'enseignant l'ajoutera).
  - "comparaison" : 2 à 3 colonnes comparant des éléments.
- N'utilise JAMAIS de bloc "media" : les images et vidéos sont ajoutées uniquement par l'enseignant.
- N'utilise "chart" ou "schema" que lorsque c'est pédagogiquement pertinent pour la phase — la
  majorité des diapositives peuvent rester en blocs "text" uniquement, comme avant.
</blocs>

<format_sortie>
Retourne UNIQUEMENT un JSON valide, sans Markdown :
{
  "titre": "string",
  "niveau": "string",
  "objectif": "string",
  "slides": [
    {
      "titre": "string",
      "type": "accroche | recherche | mise_en_commun | institutionnalisation | entrainement | synthese",
      "blocks": [
        { "type": "text", "lignes": ["string — ligne courte projetable"] }
        ou { "type": "chart", "chartType": "bar | line | pie", "titre": "string", "unite": "string",
             "categories": ["string"], "series": [{ "nom": "string", "valeurs": [0] }] }
        ou { "type": "schema", "variant": "frise", "titre": "string",
             "evenements": [{ "date": "string", "label": "string", "description": "string" }] }
        ou { "type": "schema", "variant": "cycle", "titre": "string",
             "etapes": [{ "label": "string", "description": "string" }] }
        ou { "type": "schema", "variant": "etapes", "titre": "string",
             "etapes": [{ "label": "string", "description": "string" }] }
        ou { "type": "schema", "variant": "legende", "titre": "string",
             "points": [{ "numero": 1, "x": 50, "y": 50, "label": "string" }] }
        ou { "type": "schema", "variant": "comparaison", "titre": "string",
             "colonnes": [{ "titre": "string", "points": ["string"] }] }
      ],
      "notes_enseignant": "string",
      "interaction": "string — action attendue des élèves"
    }
  ],
  "deroule_projection": ["string — repère d'utilisation pendant la séance"],
  "materiel": ["string"]
}
</format_sortie>`;

function buildPrompt(contexte: Omit<GenerateCourseRequest, "aiProvider" | "aiApiKey">) {
  const lesson = contexte.lesson!;
  const phases = lesson.phases
    .map(
      (phase, index) => `${index + 1}. ${phase.nom} (${phase.duree_minutes} min)
Disposition : ${phase.disposition_classe}
Rôle enseignant : ${phase.role_enseignant}
Consigne : ${phase.consigne}
Activité élèves : ${phase.role_eleves}
Hors-champ : ${phase.hors_champ ?? ""}
Relances : ${(phase.relances ?? []).join(" ; ")}`
    )
    .join("\n\n");

  return `Crée un cours projetable lié à cette fiche séance.

Contexte :
- Cycle : ${contexte.cycle}
- Niveau : ${contexte.niveau || lesson.niveau}
- Domaine : ${contexte.domaine}
- Sous-domaine : ${contexte.sousDomaine}
- Item : ${contexte.item}
- Compétence : ${contexte.competence}
- Séquence : ${contexte.sequenceTitle ?? ""}
- Séance : ${contexte.seanceNumero ?? ""}

Fiche séance :
- Titre : ${lesson.titre}
- Objectif : ${lesson.objectif}
- Durée : ${lesson.duree_minutes} min
- Matériel : ${lesson.materiel.join(", ")}
- Trace écrite prévue : ${lesson.trace_ecrite}
- Vigilance : ${lesson.vigilance}

Phases :
${phases}`;
}

export async function POST(request: Request) {
  const body = (await request.json()) as GenerateCourseRequest;
  const { aiProvider, aiApiKey, ...contexte } = body;

  if (!contexte.niveau || !contexte.domaine || !contexte.lesson?.titre) {
    return NextResponse.json(
      { error: "Le niveau, le domaine et la fiche séance sont obligatoires." },
      { status: 400 }
    );
  }

  const referencesContext = buildReferencesContext(
    contexte.cycle ?? "",
    contexte.niveau,
    contexte.domaine,
    "lesson"
  );
  const systemPrompt = SYSTEM_PROMPT + referencesContext;
  const prompt = buildPrompt(contexte);

  function parseCours(texte: string): CoursPresentation {
    const brut = lireObjetJsonIa<Record<string, unknown>>(texte);
    return normaliserEtValiderCours(brut);
  }

  if (aiProvider && aiApiKey && aiProvider !== "none") {
    try {
      const texte = await callAiProvider({
        provider: aiProvider as AiProvider,
        apiKey: aiApiKey,
        system: systemPrompt,
        prompt,
        maxTokens: 4000
      });

      return NextResponse.json({ course: parseCours(texte) });
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
      instructions: systemPrompt,
      input: prompt,
      max_output_tokens: 4000,
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
    return NextResponse.json({ course: parseCours(texte) });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Impossible de lire le cours généré.",
        details: texte
      },
      { status: 502 }
    );
  }
}
