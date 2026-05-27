import { NextRequest, NextResponse } from "next/server";
import { callAiProvider, type AiProvider } from "../../lib/ai-provider";
import { lireObjetJsonIa } from "../../lib/ai-json";
import {
  getUserFromRequest,
  checkAndIncrementFreeGenerations,
  FREE_GENERATIONS_MAX
} from "../../lib/supabase-server";

type GenerateFromPromptRequest = {
  aiProvider?: string;
  aiApiKey?: string;
  promptLibre: string;
};

type Beat = {
  amorce: string;
  recherche: string;
  mise_en_commun: string;
  institutionnalisation: string | null;
  entrainement: string;
};

type Seance = {
  numero: number;
  type: string;
  titre: string;
  est_seance_cloture: boolean;
  duree_minutes: number;
  beat: Beat;
  tension_ouverte: string | null;
  materiel: string[];
  differenciation: {
    soutien: string;
    approfondissement: string;
  };
};

type Sequence = {
  titre: string;
  intention: string;
  regime: string;
  seances: Seance[];
};

type Contexte = {
  cycle: string;
  niveau: string;
  domaine: string;
  sousDomaine: string;
  item: string;
  competence: string;
  objectif: string;
};

type GenerateFromPromptResult = {
  contexte: Contexte;
  sequence: Sequence;
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

function sequenceValide(sequence: Sequence): boolean {
  if (typeof sequence.titre !== "string") return false;
  if (!Array.isArray(sequence.seances) || sequence.seances.length < 2) return false;
  const toutesValides = sequence.seances.every(
    (s) =>
      typeof s.numero === "number" &&
      typeof s.titre === "string" &&
      s.beat &&
      typeof s.beat.amorce === "string" &&
      typeof s.beat.recherche === "string"
  );
  const uneSeanceCloture = sequence.seances.some((s) => s.est_seance_cloture === true);
  return toutesValides && uneSeanceCloture;
}

function buildSystemPrompt(): string {
  return `<role>
Tu es SAGE, un assistant pédagogique expert en ingénierie de formation pour l'Éducation Nationale française.
À partir d'une demande libre d'un enseignant, tu génères une progression de séquence pédagogique complète.
</role>

<mission>
1. Analyser la demande pour inférer le contexte pédagogique (cycle, niveau, domaine, etc.)
2. Générer une progression de séquence selon une logique de tension cognitive et de BEATS dramaturgiques
3. Retourner un JSON avec le contexte extrait ET la séquence générée
</mission>

<principes_dramaturgiques>
Chaque séquence suit une logique TENSION → RÉSOLUTION, pas une progression linéaire.
Chaque séance est un BEAT : une unité de changement de valeur cognitive.

Structure de chaque BEAT :
1. AMORCE — question ou énigme. Ne pas donner la réponse. Créer le manque cognitif.
2. RECHERCHE — activité principale où les élèves affrontent l'obstacle.
3. MISE EN COMMUN — confrontation des réponses. Maintenir une incertitude si ce n'est pas la séance de clôture.
4. INSTITUTIONNALISATION — le savoir prend sens. Uniquement quand est_seance_cloture est true. Null sinon.
5. ENTRAÎNEMENT — ancrage par la pratique.
</principes_dramaturgiques>

<inference_contexte>
Pour inférer le contexte :
- Cycle 1 : maternelle (PS, MS, GS)
- Cycle 2 : CP, CE1, CE2
- Cycle 3 : CM1, CM2, 6e
- Si le niveau n'est pas précisé, déduis-le du contenu demandé
- Pour le domaine, sousDomaine, item et compétence, construis des valeurs plausibles en accord avec les programmes officiels français
- L'objectif pédagogique doit être actionnable et mesurable
</inference_contexte>

<exemple_beat>
Séance de découverte CE2, Mathématiques, décomposition de nombres :
{
  "numero": 1, "type": "découverte", "titre": "Combien de façons d'écrire 247 ?",
  "est_seance_cloture": false, "duree_minutes": 55,
  "beat": {
    "amorce": "Écrivez 247 d'une autre façon. Pas 247. Une autre.",
    "recherche": "Groupes : trouver le maximum de décompositions différentes avec cubes MAB",
    "mise_en_commun": "Affichage collectif. Débat : 200+40+7 et 247 c'est le même nombre ?",
    "institutionnalisation": null,
    "entrainement": "Chacun note 3 décompositions du nombre 315"
  },
  "tension_ouverte": "Y a-t-il une décomposition canonique ? Peut-on en trouver une infinité ?",
  "materiel": ["cubes, barres, plaques MAB", "ardoises"],
  "differenciation": { "soutien": "Décomposer 47 seulement", "approfondissement": "Trouver toutes les décompositions à exactement 3 termes" }
}
</exemple_beat>

<format_sortie>
RÈGLES ABSOLUES pour le JSON :
- Retourne UNIQUEMENT le JSON brut, sans Markdown, sans balise, sans texte avant ou après
- N'utilise JAMAIS de retour à la ligne littéral dans les valeurs de chaînes — utilise uniquement des espaces
- Chaque valeur de type string doit tenir sur une seule ligne logique JSON

{
  "contexte": {
    "cycle": "Cycle 1 | Cycle 2 | Cycle 3",
    "niveau": "niveau exact (ex. CM2)",
    "domaine": "domaine disciplinaire (ex. Sciences et technologie)",
    "sousDomaine": "sous-domaine précis",
    "item": "item de compétence",
    "competence": "compétence précise issue des programmes",
    "objectif": "objectif pédagogique actionnable et mesurable"
  },
  "sequence": {
    "titre": "string — titre évocateur, pas générique",
    "intention": "string — logique de progression en une phrase",
    "regime": "ouvert",
    "seances": [
      {
        "numero": number,
        "type": "découverte | entraînement | évaluation | bilan | projet",
        "titre": "string — titre évocateur",
        "est_seance_cloture": boolean,
        "duree_minutes": number,
        "beat": {
          "amorce": "string",
          "recherche": "string",
          "mise_en_commun": "string",
          "institutionnalisation": "string ou null selon est_seance_cloture",
          "entrainement": "string"
        },
        "tension_ouverte": "string ou null selon est_seance_cloture",
        "materiel": ["string"],
        "differenciation": { "soutien": "string", "approfondissement": "string" }
      }
    ]
  }
}
</format_sortie>`;
}

function parseResult(texte: string): GenerateFromPromptResult {
  const result = lireObjetJsonIa<GenerateFromPromptResult>(texte);
  if (!result.contexte || !result.sequence) {
    throw new Error("La réponse ne contient pas les champs contexte et sequence attendus.");
  }
  if (!sequenceValide(result.sequence)) {
    throw new Error(
      "La séquence générée est incomplète : vérifier la structure beat et la présence d'une séance de clôture."
    );
  }
  return result;
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as GenerateFromPromptRequest;
  const { aiProvider, aiApiKey, promptLibre } = body;

  if (!promptLibre?.trim()) {
    return NextResponse.json(
      { error: "Le prompt de description de la séquence est obligatoire." },
      { status: 400 }
    );
  }

  const systemPrompt = buildSystemPrompt();
  const prompt = `Génère une séquence pédagogique à partir de cette demande :\n\n"${promptLibre.trim()}"`;

  if (aiProvider && aiApiKey && aiProvider !== "none") {
    try {
      const texte = await callAiProvider({
        provider: aiProvider as AiProvider,
        apiKey: aiApiKey,
        system: systemPrompt,
        prompt,
        maxTokens: 4500
      });

      const result = parseResult(texte);
      return NextResponse.json(result);
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Erreur lors de l'appel à l'IA." },
        { status: 502 }
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

  const user = await getUserFromRequest(request);
  if (user) {
    const { allowed, used } = await checkAndIncrementFreeGenerations(user.id);
    if (!allowed) {
      return NextResponse.json(
        { error: "FREE_LIMIT_REACHED", generationsUsed: used, generationsMax: FREE_GENERATIONS_MAX },
        { status: 403 }
      );
    }
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
      max_output_tokens: 4500,
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
    const result = parseResult(texte);
    return NextResponse.json(result);
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
