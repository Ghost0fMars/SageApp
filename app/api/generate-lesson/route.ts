import { NextResponse } from "next/server";
import { callAiProvider, type AiProvider } from "../../lib/ai-provider";
import { lireObjetJsonIa } from "../../lib/ai-json";

type BeatInput = {
  amorce?: string;
  recherche?: string;
  mise_en_commun?: string;
  institutionnalisation?: string | null;
  entrainement?: string;
};

type SeanceSequence = {
  numero?: number;
  type?: string;
  titre?: string;
  est_seance_cloture?: boolean;
  beat?: BeatInput;
  tension_ouverte?: string | null;
  materiel?: string[];
  differenciation?: { soutien?: string; approfondissement?: string };
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

function seanceValide(seance: SeanceDetaillee) {
  return (
    typeof seance.titre === "string" &&
    typeof seance.objectif === "string" &&
    Array.isArray(seance.phases) &&
    seance.phases.length >= 3
  );
}

const SYSTEM_PROMPT = `<role>
Tu es SAGE, un assistant pédagogique expert en préparation de séance.
Tu prépares des séances détaillées, structurées comme des mises en scène pédagogiques.
</role>

<posture_enseignant>
L'enseignant est un metteur en scène : il ne dit pas tout, il crée les conditions de la découverte.

Règles absolues :
- NE PAS donner la réponse dans l'amorce
- Ménager du silence et de la réflexion individuelle avant toute mise en commun
- Prévoir les erreurs probables et comment les exploiter — pas les éviter
- Consignes en termes d'action : "trouvez", "comparez", "cherchez" — jamais "lisez" seul
- Le champ hors_champ est aussi important que ce qu'on dit : qu'est-ce que l'enseignant ne doit PAS encore révéler à cette étape ?
</posture_enseignant>

<organisation_spatiale>
Préciser pour chaque phase la disposition de classe :
- regroupement (tapis, devant le tableau)
- individuel (à la place)
- groupes (îlots de 4)
- binômes
</organisation_spatiale>

<exemple_phase>
{
  "nom": "Amorce — la question impossible",
  "duree_minutes": 8,
  "disposition_classe": "regroupement",
  "role_enseignant": "Montrer deux photos : un carrefour en T et un carrefour en X. Demander : 'Laquelle tourne le plus fort ?' Rester silencieux. Attendre. Ne pas valider.",
  "consigne": "Choisissez une route et expliquez pourquoi elle tourne plus fort.",
  "role_eleves": "Observent, débattent par deux, formulent une opinion",
  "hors_champ": "Le mot 'angle' ne doit pas encore être prononcé. La notion de mesure non plus.",
  "erreurs_anticipees": ["confondre la largeur de la route et l'angle du virage", "comparer les longueurs plutôt que les directions"],
  "relances": ["Comment expliqueriez-vous ça à quelqu'un sans la photo ?", "Et si les deux routes étaient identiques en couleur ?"],
  "materiel": "2 photos projetées ou imprimées"
}
</exemple_phase>

<format_sortie>
Retourne UNIQUEMENT un JSON valide, sans Markdown :
{
  "titre": "string",
  "objectif": "string",
  "niveau": "string",
  "duree_minutes": number,
  "materiel": ["string"],
  "phases": [
    {
      "nom": "string",
      "duree_minutes": number,
      "disposition_classe": "regroupement | individuel | groupes | binômes",
      "role_enseignant": "string — paroles et gestes précis si pertinent",
      "consigne": "string — formulée pour les élèves",
      "role_eleves": "string",
      "hors_champ": "string ou null",
      "erreurs_anticipees": ["string"],
      "relances": ["string"],
      "materiel": "string"
    }
  ],
  "trace_ecrite": "string",
  "vigilance": "string"
}
</format_sortie>`;

function buildPrompt(contexte: Omit<GenerateLessonRequest, "aiProvider" | "aiApiKey">) {
  const s = contexte.seance!;
  const beatInfo = s.beat
    ? `- Structure prévue :
  Amorce : ${s.beat.amorce ?? ""}
  Recherche : ${s.beat.recherche ?? ""}
  Mise en commun : ${s.beat.mise_en_commun ?? ""}
  Entraînement : ${s.beat.entrainement ?? ""}`
    : "";

  const tensionInfo = s.tension_ouverte
    ? `- Tension à maintenir ouverte : ${s.tension_ouverte}`
    : "";

  const cloture = s.est_seance_cloture
    ? "- C'est la séance de clôture : inclure l'institutionnalisation."
    : "";

  const differenciationInfo =
    s.differenciation?.soutien || s.differenciation?.approfondissement
      ? `- Différenciation prévue :
  Soutien : ${s.differenciation?.soutien ?? ""}
  Approfondissement : ${s.differenciation?.approfondissement ?? ""}`
      : "";

  return `Prépare une séance détaillée à partir de ces informations :
- Cycle : ${contexte.cycle}
- Niveau : ${contexte.niveau}
- Domaine : ${contexte.domaine}
- Sous-domaine : ${contexte.sousDomaine}
- Item : ${contexte.item}
- Compétence : ${contexte.competence}
- Objectif de la séquence : ${contexte.objectifSequence}
- Séance ${s.numero ?? ""}, type "${s.type ?? ""}", titre "${s.titre}"
${beatInfo}
${tensionInfo}
${cloture}
${differenciationInfo}`;
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
    !contexte.seance?.titre
  ) {
    return NextResponse.json(
      { error: "Les éléments de contexte, l'objectif et la séance choisie sont obligatoires." },
      { status: 400 }
    );
  }

  const prompt = buildPrompt(contexte);

  function parseSeance(texte: string) {
    const seance = lireObjetJsonIa<SeanceDetaillee>(texte);
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
        maxTokens: 2800
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
      max_output_tokens: 2800,
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
