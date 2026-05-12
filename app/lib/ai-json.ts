type JsonRecord = Record<string, unknown>;

function extraireBlocJson(texte: string) {
  const debut = texte.indexOf("{");
  const fin = texte.lastIndexOf("}");

  if (debut === -1 || fin === -1 || fin < debut) {
    throw new Error("La réponse de l'IA ne contient pas de JSON exploitable.");
  }

  return texte.slice(debut, fin + 1).trim();
}

function nettoyerJsonFrequent(json: string) {
  return json.replace(/,\s*([}\]])/g, "$1");
}

export function lireObjetJsonIa<T extends JsonRecord>(texte: string): T {
  const brut = extraireBlocJson(texte);

  try {
    return JSON.parse(brut) as T;
  } catch {
    const nettoye = nettoyerJsonFrequent(brut);

    if (nettoye !== brut) {
      try {
        return JSON.parse(nettoye) as T;
      } catch {
        // On retombe sur l'erreur utilisateur simplifiée ci-dessous.
      }
    }

    throw new Error(
      "La réponse de l'IA n'était pas un JSON valide. Relancez la génération."
    );
  }
}
