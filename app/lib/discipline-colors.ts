export type DisciplineColor = {
  accent: string;
  background: string;
  softBackground: string;
  text: string;
  border: string;
};

const defaultColor: DisciplineColor = {
  accent: "#006b60",
  background: "#006b60",
  softBackground: "#e6f3ef",
  text: "#032026",
  border: "#006b60"
};

const colors = {
  francais: {
    accent: "#00558c",
    background: "#00558c",
    softBackground: "#e6f1f8",
    text: "#003856",
    border: "#00558c"
  },
  mathematiques: {
    accent: "#d60000",
    background: "#d60000",
    softBackground: "#ffecec",
    text: "#730000",
    border: "#d60000"
  },
  arts: {
    accent: "#7a4308",
    background: "#7a4308",
    softBackground: "#f7eee5",
    text: "#4f2b05",
    border: "#7a4308"
  },
  eps: {
    accent: "#ff9d00",
    background: "#ff9d00",
    softBackground: "#fff3dc",
    text: "#6d3f00",
    border: "#ff9d00"
  },
  histoireGeographie: {
    accent: "#707780",
    background: "#707780",
    softBackground: "#eef1f3",
    text: "#3f464c",
    border: "#707780"
  },
  sciences: {
    accent: "#198a00",
    background: "#198a00",
    softBackground: "#edf8e9",
    text: "#145f05",
    border: "#198a00"
  },
  langues: {
    accent: "#c51ca6",
    background: "#c51ca6",
    softBackground: "#fbe8f7",
    text: "#7d116a",
    border: "#c51ca6"
  },
  emc: {
    accent: "#7224c9",
    background: "#7224c9",
    softBackground: "#f1e8fb",
    text: "#4a1685",
    border: "#7224c9"
  }
} satisfies Record<string, DisciplineColor>;

function normaliser(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function getDisciplineColor(domaine: string | undefined): DisciplineColor {
  const normalized = normaliser(domaine ?? "");

  if (
    normalized.includes("francais") ||
    normalized.includes("langage oral") ||
    normalized.includes("langage oral et ecrit") ||
    normalized.includes("oral ecrit")
  ) {
    return colors.francais;
  }

  if (
    normalized.includes("mathematique") ||
    normalized.includes("premiers outils mathematiques")
  ) {
    return colors.mathematiques;
  }

  if (
    normalized.includes("arts plastiques") ||
    normalized.includes("education musicale") ||
    normalized.includes("histoire des arts") ||
    normalized.includes("enseignements artistiques") ||
    normalized.includes("activites artistiques")
  ) {
    return colors.arts;
  }

  if (
    normalized.includes("education physique") ||
    normalized.includes("activite physique") ||
    normalized.includes("eps")
  ) {
    return colors.eps;
  }

  if (normalized.includes("histoire") || normalized.includes("geographie") || normalized.includes("questionner le monde")) {
    return colors.histoireGeographie;
  }

  if (
    normalized.includes("sciences") ||
    normalized.includes("technologie") ||
    normalized.includes("explorer le monde")
  ) {
    return colors.sciences;
  }

  if (normalized.includes("langues vivantes") || normalized.includes("langue vivante")) {
    return colors.langues;
  }

  if (
    normalized.includes("enseignement moral") ||
    normalized.includes("emc") ||
    normalized.includes("apprendre ensemble") ||
    normalized.includes("vivre ensemble")
  ) {
    return colors.emc;
  }

  return defaultColor;
}
