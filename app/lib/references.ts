import { readFileSync } from "fs";
import { join } from "path";

type AttendusEntry = {
  matiere: string;
  niveau: string;
  domaine: string;
  competence: string;
  criteres: string;
  exemples: string;
};

type FichesEntry = {
  matiere: string;
  niveau: string;
  titre: string;
  section: string;
  contenu: string;
};

type GuidesEntry = {
  cycle: string;
  titre_guide: string;
  matiere: string;
  niveau: string;
  section: string;
  contenu: string;
};

let attendusCache: AttendusEntry[] | null = null;
let fichesCache: FichesEntry[] | null = null;
let guidesCache: GuidesEntry[] | null = null;

function loadJSON<T>(filename: string): T[] {
  try {
    const filePath = join(process.cwd(), "references", filename);
    return JSON.parse(readFileSync(filePath, "utf-8")) as T[];
  } catch {
    return [];
  }
}

function getAttendus(): AttendusEntry[] {
  if (!attendusCache) attendusCache = loadJSON<AttendusEntry>("attendus.json");
  return attendusCache;
}

function getFiches(): FichesEntry[] {
  if (!fichesCache) fichesCache = loadJSON<FichesEntry>("fiches.json");
  return fichesCache;
}

function getGuides(): GuidesEntry[] {
  if (!guidesCache) guidesCache = loadJSON<GuidesEntry>("guides.json");
  return guidesCache;
}

function norm(s: string): string {
  return (s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}

// Groupes de matières qui se recoupent dans les référentiels
const GROUPES_MATIERES: string[][] = [
  ["francais", "etude de la langue", "syntaxe", "vocabulaire", "lecture", "ecriture", "langage", "oral"],
  ["mathematiques", "maths", "nombres", "calcul", "geometrie", "mesure"],
  ["sciences", "sciences et technologie", "technologie", "physique", "chimie", "biologie"],
  ["histoire", "geographie", "histoire-geographie", "histoire et geographie", "emc", "enseignement moral", "civique"],
  ["arts", "arts plastiques", "education musicale", "musique"],
  ["eps", "education physique", "sport"],
];

function groupeContenant(s: string): string[] {
  const n = norm(s);
  return GROUPES_MATIERES.find((g) => g.some((t) => n.includes(t) || t.includes(n))) ?? [n];
}

function matchesMatieres(matiere: string, domaine: string): boolean {
  if (!matiere || !domaine) return false;
  const m = norm(matiere);
  const d = norm(domaine);
  if (m === d || m.includes(d) || d.includes(m)) return true;
  const gm = groupeContenant(matiere);
  const gd = groupeContenant(domaine);
  return gm.some((t) => gd.includes(t));
}

function matchesCycle(guideCycle: string, requestCycle: string): boolean {
  if (!guideCycle) return true; // pas de restriction de cycle → s'applique à tous
  return norm(guideCycle).includes(norm(requestCycle)) || norm(requestCycle).includes(norm(guideCycle));
}

function truncate(s: string, max: number): string {
  if (!s) return "";
  const trimmed = s.replace(/\s+/g, " ").trim();
  return trimmed.length <= max ? trimmed : trimmed.slice(0, max) + "…";
}

// ─── API publique ──────────────────────────────────────────────────────────

export type ReferenceMode = "objective" | "sequence" | "lesson";

export function buildReferencesContext(
  cycle: string,
  niveau: string,
  domaine: string,
  mode: ReferenceMode
): string {
  const sections: string[] = [];

  // 1. Attendus de fin d'année (toutes les routes)
  const attendus = getAttendus()
    .filter((a) => a.niveau === niveau && matchesMatieres(a.matiere, domaine))
    .slice(0, mode === "objective" ? 3 : 5);

  if (attendus.length > 0) {
    const lines = attendus.map((a) => {
      const base = `• ${a.competence}`;
      const detail =
        mode !== "objective" && a.exemples
          ? `\n  Exemple : ${truncate(a.exemples, 180)}`
          : "";
      return base + detail;
    });
    sections.push(
      `<attendus_officiels niveau="${niveau}" matiere="${domaine}">\n${lines.join("\n")}\n</attendus_officiels>`
    );
  }

  // 2. Guides pédagogiques (séquence + séance)
  if (mode === "sequence" || mode === "lesson") {
    const guides = getGuides()
      .filter(
        (g) => matchesMatieres(g.matiere, domaine) && matchesCycle(g.cycle, cycle)
      )
      .slice(0, 3);

    if (guides.length > 0) {
      const lines = guides.map(
        (g) =>
          `[${g.titre_guide}${g.niveau ? ` — ${g.niveau}` : ""}]\n${truncate(g.contenu, 350)}`
      );
      sections.push(
        `<ressources_pedagogiques_officielles>\n${lines.join("\n\n")}\n</ressources_pedagogiques_officielles>`
      );
    }
  }

  // 3. Fiches d'activités (séance uniquement)
  if (mode === "lesson") {
    const fiches = getFiches()
      .filter((f) => matchesMatieres(f.matiere, domaine))
      .slice(0, 3);

    if (fiches.length > 0) {
      const lines = fiches.map(
        (f) => `[${f.titre}]\n${truncate(f.contenu, 280)}`
      );
      sections.push(
        `<exemples_activites_pedagogiques>\n${lines.join("\n\n")}\n</exemples_activites_pedagogiques>`
      );
    }
  }

  if (sections.length === 0) return "";

  return (
    `\n<base_de_connaissance>\n` +
    `Ressources officielles pour ${domaine} — ${niveau}. ` +
    `Appuie-toi sur elles pour ancrer ta réponse dans les attendus réels.\n\n` +
    sections.join("\n\n") +
    `\n</base_de_connaissance>`
  );
}
