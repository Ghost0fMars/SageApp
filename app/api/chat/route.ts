import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type Message = {
  role: "user" | "assistant";
  content: string;
};

type ChatRequest = {
  messages: Message[];
  context: string;
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

type DocumentChunk = {
  content: string;
  similarity: number;
};

function extraireTexteOpenAI(data: OpenAIResponse) {
  return (
    data.output
      ?.flatMap((item) => item.content ?? [])
      .find((content) => content.type === "output_text")
      ?.text?.trim() ?? ""
  );
}

function getBearerToken(request: NextRequest) {
  const authorization = request.headers.get("authorization");
  return authorization?.startsWith("Bearer ") ? authorization.slice("Bearer ".length) : null;
}

async function verifierUtilisateur(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const token = getBearerToken(request);

  if (!supabaseUrl || !supabaseAnonKey) {
    return { error: "Supabase n'est pas configuré.", status: 500 } as const;
  }

  if (!token) {
    return { error: "Connexion requise pour utiliser l'assistant.", status: 401 } as const;
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: { Authorization: `Bearer ${token}` }
    }
  });
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    return { error: "Session invalide. Reconnectez-vous.", status: 401 } as const;
  }

  const { data: access } = await supabase
    .from("user_access")
    .select("status")
    .eq("user_id", data.user.id)
    .maybeSingle();

  if (access?.status !== "approved") {
    return { error: "Votre compte doit être validé pour utiliser l'assistant.", status: 403 } as const;
  }

  return { user: data.user } as const;
}

async function rechercherDocumentation(question: string, apiKey: string): Promise<string> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return "";
  }

  const embeddingResponse = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "text-embedding-3-small",
      input: question
    })
  });

  if (!embeddingResponse.ok) {
    return "";
  }

  const embeddingData = (await embeddingResponse.json()) as {
    data: { embedding: number[] }[];
  };
  const embedding = embeddingData.data[0]?.embedding;

  if (!embedding) {
    return "";
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const { data: chunks, error } = await supabase.rpc("match_document_chunks", {
    query_embedding: embedding,
    match_count: 6,
    match_threshold: 0.45
  });

  if (error || !chunks || (chunks as DocumentChunk[]).length === 0) {
    return "";
  }

  return (chunks as DocumentChunk[]).map((chunk) => chunk.content).join("\n\n---\n\n");
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "La variable OPENAI_API_KEY est manquante dans .env.local." },
      { status: 500 }
    );
  }

  const auth = await verifierUtilisateur(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { messages, context } = (await request.json()) as ChatRequest;

  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: "Le message est obligatoire." }, { status: 400 });
  }

  const dernierMessage = messages[messages.length - 1]?.content?.trim() ?? "";

  if (!dernierMessage) {
    return NextResponse.json({ error: "Le message est vide." }, { status: 400 });
  }

  const docContext = await rechercherDocumentation(dernierMessage, apiKey).catch(() => "");

  const instructions = `Tu es l'assistant pédagogique intégré à Sage, un outil pour les enseignants du primaire. Tu aides l'enseignant à :
- Rédiger des appréciations pour le livret scolaire (2-4 phrases, ton positif et constructif)
- Identifier les élèves en difficulté ou en réussite selon les évaluations
- Analyser les progressions par domaine ou par compétence
- Formuler des bilans personnalisés à partir des notes de suivi
- Répondre à toute question d'ordre pédagogique ou de gestion de classe

[DONNÉES DE LA CLASSE]
${context}
${
    docContext
      ? `\n[DOCUMENTATION INSTITUTIONNELLE PERTINENTE]\n${docContext}\n\nAppuie-toi sur cette documentation pour enrichir tes réponses. Cite les sources ou indique qu'il s'agit de recommandations institutionnelles quand tu t'y réfères.`
      : ""
  }

Consignes :
- Réponds toujours en français.
- Pour les questions sur des élèves spécifiques, appuie-toi sur les données de la classe.
- Pour les questions pédagogiques générales (gestion de classe, différenciation, comportement, relations avec les familles...), réponds avec ton expertise professionnelle et les recommandations institutionnelles disponibles.
- Pour les appréciations destinées au livret scolaire, utilise un registre formel, bienveillant et précis, 2 à 4 phrases par élève.
- Ne mentionne jamais "Non évalué" dans une appréciation publique.
- Pour les analyses, cite les données précises : niveaux d'acquisition, domaines, dates d'évaluation.
- Si on te demande des appréciations pour plusieurs élèves, génère-les toutes dans un seul message en les séparant clairement.`;

  const historique = messages
    .slice(0, -1)
    .map((message) => `${message.role === "user" ? "Enseignant" : "Assistant"} : ${message.content}`)
    .join("\n\n");

  const input = historique
    ? `[Historique de la conversation]\n${historique}\n\n[Nouveau message]\nEnseignant : ${dernierMessage}`
    : dernierMessage;

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL ?? "gpt-5.4-mini",
      instructions,
      input,
      max_output_tokens: 2500,
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
  const content = extraireTexteOpenAI(data);

  if (!content) {
    return NextResponse.json(
      { error: "L'API OpenAI n'a pas renvoyé de texte exploitable." },
      { status: 502 }
    );
  }

  return NextResponse.json({ content });
}
