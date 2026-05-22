"use client";

import { useEffect, useMemo, useState } from "react";
import { getDisciplineColor } from "../lib/discipline-colors";
import { readAiConfig } from "../lib/ai-config";
import { readUserData, writeUserData } from "../lib/user-storage";
import FicheSeanceModal, { type SeanceDetaillee } from "../components/FicheSeanceModal";
import FicheEleveViewer from "../components/FicheEleveViewer";
import CoursViewer from "../components/CoursViewer";

type Beat = {
  amorce: string;
  recherche: string;
  mise_en_commun: string;
  institutionnalisation: string | null;
  entrainement: string;
};

type SeanceProgression = {
  numero: number;
  type: string;
  titre: string;
  est_seance_cloture?: boolean;
  duree_minutes?: number;
  beat?: Beat;
  tension_ouverte?: string | null;
  materiel?: string[];
  differenciation?: { soutien?: string; approfondissement?: string };
};

type Sequence = {
  titre: string;
  intention: string;
  regime?: string;
  seances: SeanceProgression[];
};

type SequencePreparee = {
  id: string;
  createdAt: string;
  cycle: string;
  niveau: string;
  domaine: string;
  sousDomaine: string;
  item: string;
  competence: string;
  objectif: string;
  sequence: Sequence;
};

type SeancePreparee = {
  id: string;
  createdAt: string;
  cycle: string;
  niveau: string;
  domaine: string;
  sousDomaine: string;
  item: string;
  competence: string;
  sequenceTitle: string;
  sequenceTotal: number;
  seanceNumero: number;
  seanceType: string;
  lesson: SeanceDetaillee;
};

type FicheActiviteEleve = {
  titre: string;
  niveau: string;
  objectif: string;
  consigne: string;
  support: string;
  activites: {
    titre: string;
    consigne: string;
    format_reponse: string;
    aides: string[];
  }[];
  differenciation: {
    soutien: string;
    approfondissement: string;
  };
  correction: string[];
};

type ActiviteEleveSauvegardee = {
  id: string;
  createdAt: string;
  preparedLessonId?: string;
  cycle: string;
  niveau: string;
  domaine: string;
  sousDomaine: string;
  item: string;
  competence: string;
  sequenceTitle: string;
  seanceNumero: number;
  activity: FicheActiviteEleve;
};

type CoursPresentation = {
  titre: string;
  niveau: string;
  objectif: string;
  slides: {
    titre: string;
    type: string;
    contenu: string[];
    notes_enseignant: string;
    interaction: string;
  }[];
  deroule_projection: string[];
  materiel: string[];
};

type CoursSauvegarde = {
  id: string;
  createdAt: string;
  preparedLessonId?: string;
  cycle: string;
  niveau: string;
  domaine: string;
  sousDomaine: string;
  item: string;
  competence: string;
  sequenceTitle: string;
  seanceNumero: number;
  course: CoursPresentation;
};

type TuilePlanning = {
  id: string;
  preparedLessonId?: string;
  titreSequence: string;
  seanceLabel: string;
  domaine: string;
  dureeMinutes: number;
  lesson: SeanceDetaillee;
  day?: string;
  startMinute?: number;
};

type DossierSequences = Record<
  string,
  Record<string, Record<string, Record<string, SequencePreparee[]>>>
>;

type DossierBibliotheque = "preparations" | "activites" | "cours";

const PREPARED_LESSONS_STORAGE_KEY = "sage-prepared-lessons";
const STUDENT_ACTIVITIES_STORAGE_KEY = "sage-student-activities";
const COURSE_PRESENTATIONS_STORAGE_KEY = "sage-course-presentations";
const PLANNING_STORAGE_KEY = "sage-planning-tiles";
const SEQUENCES_STORAGE_KEY = "sage-sequences";

function cleSeance(sequence: SequencePreparee, numero: number) {
  return [
    sequence.cycle,
    sequence.niveau,
    sequence.domaine,
    sequence.sousDomaine,
    sequence.sequence.titre,
    numero
  ].join("|||");
}

function trouverFiche(
  fiches: SeancePreparee[],
  sequence: SequencePreparee,
  seance: SeanceProgression
) {
  return fiches.find(
    (fiche) =>
      fiche.cycle === sequence.cycle &&
      fiche.niveau === sequence.niveau &&
      fiche.domaine === sequence.domaine &&
      fiche.sousDomaine === sequence.sousDomaine &&
      fiche.sequenceTitle === sequence.sequence.titre &&
      fiche.seanceNumero === seance.numero
  );
}

function ajouterAuPlanning(seance: SeancePreparee) {
  const tuilesExistantes = readUserData<TuilePlanning[]>(
    PLANNING_STORAGE_KEY,
    [],
    PLANNING_STORAGE_KEY
  );

  const tuile: TuilePlanning = {
    id: crypto.randomUUID(),
    preparedLessonId: seance.id,
    titreSequence: seance.sequenceTitle,
    seanceLabel: `${seance.seanceNumero}/${seance.sequenceTotal}`,
    domaine: seance.domaine,
    dureeMinutes: seance.lesson.duree_minutes,
    lesson: seance.lesson
  };

  writeUserData(PLANNING_STORAGE_KEY, [...tuilesExistantes, tuile]);
}

function imprimerFiche(fiche: SeancePreparee) {
  const fenetre = window.open("", "_blank", "width=900,height=700");
  if (!fenetre) return;

  const e = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const date = new Date().toLocaleDateString("fr-FR", {
    day: "numeric", month: "long", year: "numeric"
  });

  const phasesHtml = (fiche.lesson.phases ?? [])
    .map(
      (phase, i) => `
      <section class="phase">
        <h2>Phase ${i + 1} — ${e(phase.nom)}</h2>
        <p class="meta">${[`${phase.duree_minutes} min`, phase.disposition_classe].filter(Boolean).map(e).join(" · ")}</p>
        ${phase.role_enseignant ? `<h3>Rôle enseignant</h3><p>${e(phase.role_enseignant)}</p>` : ""}
        ${phase.consigne ? `<h3>Consigne</h3><p>${e(phase.consigne)}</p>` : ""}
        ${phase.role_eleves ? `<h3>Activité élèves</h3><p>${e(phase.role_eleves)}</p>` : ""}
        ${phase.hors_champ ? `<h3>Hors-champ</h3><p>${e(phase.hors_champ)}</p>` : ""}
        ${phase.erreurs_anticipees?.length ? `<h3>Erreurs anticipées</h3><ul>${phase.erreurs_anticipees.map((err) => `<li>${e(err)}</li>`).join("")}</ul>` : ""}
        ${phase.relances?.length ? `<h3>Relances</h3><ul>${phase.relances.map((r) => `<li>${e(r)}</li>`).join("")}</ul>` : ""}
        ${phase.materiel ? `<h3>Matériel</h3><p>${e(phase.materiel)}</p>` : ""}
      </section>`
    )
    .join("");

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>${e(fiche.lesson.titre)}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Georgia, serif; font-size: 11pt; line-height: 1.6; color: #111; padding: 1.8cm 2.5cm 2cm; }
    h1 { font-size: 20pt; font-weight: bold; margin-bottom: 5pt; }
    h2 { font-size: 13pt; font-weight: bold; margin: 18pt 0 4pt; border-bottom: 1px solid #d1d5db; padding-bottom: 3pt; }
    h3 { font-size: 9pt; font-weight: bold; text-transform: uppercase; letter-spacing: .07em; margin: 10pt 0 2pt; color: #555; }
    p { margin-bottom: 6pt; white-space: pre-wrap; }
    ul { margin: 4pt 0 6pt 1.4em; }
    li { margin-bottom: 2pt; }
    .label { font-size: 8pt; font-weight: bold; letter-spacing: .18em; text-transform: uppercase; color: #9ca3af; margin-bottom: 6pt; }
    .subtitle { font-size: 10pt; color: #6b7280; margin-bottom: 12pt; }
    .meta { font-size: 9pt; color: #6b7280; margin-bottom: 6pt; font-style: italic; }
    .intro { margin-bottom: 18pt; padding-bottom: 14pt; border-bottom: 2px solid #111; }
    .phase { margin-top: 14pt; break-inside: avoid; }
    .section { margin-top: 14pt; break-inside: avoid; }
    .doc-header { display: flex; justify-content: space-between; align-items: center; padding-bottom: 7pt; margin-bottom: 18pt; border-bottom: 1px solid #e5e7eb; }
    .doc-brand { font-size: 8pt; font-weight: bold; letter-spacing: .25em; text-transform: uppercase; color: #d1d5db; }
    .doc-date { font-size: 8pt; color: #9ca3af; }
    @page {
      size: A4;
      margin: 2cm 2.5cm 2.5cm;
      @bottom-center { content: "— " counter(page) " —"; font-family: Georgia, serif; font-size: 8pt; color: #9ca3af; }
      @bottom-right { content: "SAGE"; font-family: Georgia, serif; font-size: 7pt; letter-spacing: .2em; text-transform: uppercase; color: #d1d5db; }
    }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>
  <div class="doc-header">
    <span class="doc-brand">SAGE</span>
    <span class="doc-date">${date}</span>
  </div>
  <div class="intro">
    <p class="label">Fiche de séance</p>
    <h1>${e(fiche.lesson.titre)}</h1>
    <p class="subtitle">${[fiche.sequenceTitle, `Séance ${fiche.seanceNumero}`, fiche.seanceType, fiche.lesson.niveau, `${fiche.lesson.duree_minutes} min`].filter(Boolean).map(e).join(" · ")}</p>
    ${fiche.lesson.objectif ? `<h3>Objectif</h3><p>${e(fiche.lesson.objectif)}</p>` : ""}
    ${fiche.lesson.materiel?.length ? `<h3>Matériel</h3><p>${fiche.lesson.materiel.map(e).join(", ")}</p>` : ""}
  </div>
  ${phasesHtml}
  ${fiche.lesson.trace_ecrite ? `<div class="section"><h2>Trace écrite</h2><p>${e(fiche.lesson.trace_ecrite)}</p></div>` : ""}
  ${fiche.lesson.vigilance ? `<div class="section"><h2>Vigilance</h2><p>${e(fiche.lesson.vigilance)}</p></div>` : ""}
</body>
</html>`;

  fenetre.document.write(html);
  fenetre.document.close();
  fenetre.focus();
  fenetre.print();
}

export default function BibliothequePage() {
  const [sequences, setSequences] = useState<SequencePreparee[]>([]);
  const [fiches, setFiches] = useState<SeancePreparee[]>([]);
  const [activites, setActivites] = useState<ActiviteEleveSauvegardee[]>([]);
  const [cours, setCours] = useState<CoursSauvegarde[]>([]);
  const [tuilesPlanning, setTuilesPlanning] = useState<TuilePlanning[]>([]);
  const [dossierActif, setDossierActif] = useState<DossierBibliotheque>("preparations");
  const [ficheEnModal, setFicheEnModal] = useState<SeancePreparee | null>(null);
  const [activiteEnViewer, setActiviteEnViewer] = useState<ActiviteEleveSauvegardee | null>(null);
  const [coursEnViewer, setCoursEnViewer] = useState<CoursSauvegarde | null>(null);
  const [message, setMessage] = useState("");
  const [preparationEnCours, setPreparationEnCours] = useState("");
  const [activiteEnCours, setActiviteEnCours] = useState("");
  const [coursEnCours, setCoursEnCours] = useState("");

  useEffect(() => {
    function chargerDonnees() {
      setSequences(
        readUserData<SequencePreparee[]>(SEQUENCES_STORAGE_KEY, [], SEQUENCES_STORAGE_KEY)
      );
      setFiches(
        readUserData<SeancePreparee[]>(PREPARED_LESSONS_STORAGE_KEY, [], PREPARED_LESSONS_STORAGE_KEY)
      );
      setActivites(
        readUserData<ActiviteEleveSauvegardee[]>(
          STUDENT_ACTIVITIES_STORAGE_KEY,
          [],
          STUDENT_ACTIVITIES_STORAGE_KEY
        )
      );
      setCours(
        readUserData<CoursSauvegarde[]>(
          COURSE_PRESENTATIONS_STORAGE_KEY,
          [],
          COURSE_PRESENTATIONS_STORAGE_KEY
        )
      );
      setTuilesPlanning(
        readUserData<TuilePlanning[]>(PLANNING_STORAGE_KEY, [], PLANNING_STORAGE_KEY)
      );
    }

    chargerDonnees();
    window.addEventListener("focus", chargerDonnees);
    document.addEventListener("visibilitychange", chargerDonnees);
    return () => {
      window.removeEventListener("focus", chargerDonnees);
      document.removeEventListener("visibilitychange", chargerDonnees);
    };
  }, []);

  const dossiers = useMemo(() => {
    return sequences.reduce<DossierSequences>((acc, sequence) => {
      acc[sequence.cycle] ??= {};
      acc[sequence.cycle][sequence.niveau] ??= {};
      acc[sequence.cycle][sequence.niveau][sequence.domaine] ??= {};
      acc[sequence.cycle][sequence.niveau][sequence.domaine][sequence.sousDomaine] ??= [];
      acc[sequence.cycle][sequence.niveau][sequence.domaine][sequence.sousDomaine].push(sequence);
      return acc;
    }, {});
  }, [sequences]);

  const dossiersBibliotheque: Array<{
    id: DossierBibliotheque;
    titre: string;
    description: string;
    compteur: number;
  }> = [
    {
      id: "preparations",
      titre: "Fiches de préparation",
      description: "Séances générées depuis Préparer, avec leurs progressions.",
      compteur: fiches.length
    },
    {
      id: "activites",
      titre: "Activités",
      description: "Fiches élèves et supports d'activité à distribuer en classe.",
      compteur: activites.length
    },
    {
      id: "cours",
      titre: "Cours",
      description: "Présentations enseignant à diffuser pendant la séance.",
      compteur: cours.length
    }
  ];

  async function preparerSeance(sequence: SequencePreparee, seance: SeanceProgression) {
    const idPreparation = cleSeance(sequence, seance.numero);
    setPreparationEnCours(idPreparation);
    setMessage("");

    try {
      const aiConfig = readAiConfig();
      const response = await fetch("/api/generate-lesson", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cycle: sequence.cycle,
          niveau: sequence.niveau,
          domaine: sequence.domaine,
          sousDomaine: sequence.sousDomaine,
          item: sequence.item,
          competence: sequence.competence,
          objectifSequence: sequence.objectif,
          seance,
          aiProvider: aiConfig?.provider,
          aiApiKey: aiConfig?.apiKey
        })
      });

      const data = (await response.json()) as { seance?: SeanceDetaillee; error?: string };

      if (!response.ok || !data.seance) {
        throw new Error(data.error ?? "Impossible de préparer la séance.");
      }

      const fiche: SeancePreparee = {
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        cycle: sequence.cycle,
        niveau: sequence.niveau,
        domaine: sequence.domaine,
        sousDomaine: sequence.sousDomaine,
        item: sequence.item,
        competence: sequence.competence,
        sequenceTitle: sequence.sequence.titre,
        sequenceTotal: sequence.sequence.seances.length,
        seanceNumero: seance.numero,
        seanceType: seance.type,
        lesson: data.seance
      };

      const nouvellesFiches = [...fiches, fiche];
      setFiches(nouvellesFiches);
      writeUserData(PREPARED_LESSONS_STORAGE_KEY, nouvellesFiches);
      setFicheEnModal(fiche);
      setMessage(`La fiche de séance ${seance.numero} a été préparée et enregistrée.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Une erreur inconnue est survenue.");
    } finally {
      setPreparationEnCours("");
    }
  }

  function renvoyerEnReserve(seance: SeancePreparee) {
    if (tuilesPlanning.some((tuile) => tuile.preparedLessonId === seance.id)) return;
    ajouterAuPlanning(seance);
    setTuilesPlanning(readUserData<TuilePlanning[]>(PLANNING_STORAGE_KEY, [], PLANNING_STORAGE_KEY));
    setMessage(
      `La séance ${seance.seanceNumero}/${seance.sequenceTotal} a été renvoyée dans la réserve du planning.`
    );
  }

  function modifierSequenceSauvegardee(
    sequenceOriginale: SequencePreparee,
    prochaineSequence: Sequence
  ) {
    const prochainesSequences = sequences.map((s) =>
      s.id === sequenceOriginale.id ? { ...s, sequence: prochaineSequence } : s
    );
    const prochainesFiches = fiches.map((fiche) =>
      fiche.cycle === sequenceOriginale.cycle &&
      fiche.niveau === sequenceOriginale.niveau &&
      fiche.domaine === sequenceOriginale.domaine &&
      fiche.sousDomaine === sequenceOriginale.sousDomaine &&
      fiche.sequenceTitle === sequenceOriginale.sequence.titre
        ? { ...fiche, sequenceTitle: prochaineSequence.titre }
        : fiche
    );
    const prochainesTuiles = tuilesPlanning.map((tuile) =>
      prochainesFiches.some(
        (fiche) =>
          fiche.id === tuile.preparedLessonId &&
          fiche.sequenceTitle === prochaineSequence.titre
      )
        ? { ...tuile, titreSequence: prochaineSequence.titre }
        : tuile
    );

    setSequences(prochainesSequences);
    setFiches(prochainesFiches);
    setTuilesPlanning(prochainesTuiles);
    writeUserData(SEQUENCES_STORAGE_KEY, prochainesSequences);
    writeUserData(PREPARED_LESSONS_STORAGE_KEY, prochainesFiches);
    writeUserData(PLANNING_STORAGE_KEY, prochainesTuiles);
  }

  function modifierSeanceProgressionSauvegardee(
    sequence: SequencePreparee,
    numero: number,
    miseAJour: Partial<SeanceProgression>
  ) {
    modifierSequenceSauvegardee(sequence, {
      ...sequence.sequence,
      seances: sequence.sequence.seances.map((seance) =>
        seance.numero === numero ? { ...seance, ...miseAJour } : seance
      )
    });
  }

  function modifierFicheSauvegardee(ficheId: string, prochaineFiche: SeancePreparee) {
    const prochainesFiches = fiches.map((fiche) =>
      fiche.id === ficheId ? prochaineFiche : fiche
    );
    const prochainesTuiles = tuilesPlanning.map((tuile) =>
      tuile.preparedLessonId === ficheId
        ? {
            ...tuile,
            titreSequence: prochaineFiche.sequenceTitle,
            domaine: prochaineFiche.domaine,
            dureeMinutes: prochaineFiche.lesson.duree_minutes,
            lesson: prochaineFiche.lesson
          }
        : tuile
    );

    setFiches(prochainesFiches);
    setTuilesPlanning(prochainesTuiles);
    writeUserData(PREPARED_LESSONS_STORAGE_KEY, prochainesFiches);
    writeUserData(PLANNING_STORAGE_KEY, prochainesTuiles);
  }

  function modifierLessonSauvegardee(fiche: SeancePreparee, lesson: SeanceDetaillee) {
    modifierFicheSauvegardee(fiche.id, { ...fiche, lesson });
  }

  async function genererActiviteEleve(fiche: SeancePreparee, lesson: SeanceDetaillee) {
    setActiviteEnCours(fiche.id);
    setMessage("");

    try {
      const aiConfig = readAiConfig();
      const response = await fetch("/api/generate-student-activity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cycle: fiche.cycle,
          niveau: fiche.niveau || lesson.niveau,
          domaine: fiche.domaine,
          sousDomaine: fiche.sousDomaine,
          item: fiche.item,
          competence: fiche.competence,
          sequenceTitle: fiche.sequenceTitle,
          seanceNumero: fiche.seanceNumero,
          lesson,
          aiProvider: aiConfig?.provider,
          aiApiKey: aiConfig?.apiKey
        })
      });

      const data = (await response.json()) as {
        activity?: FicheActiviteEleve;
        error?: string;
      };

      if (!response.ok || !data.activity) {
        throw new Error(data.error ?? "Impossible de générer la fiche élève.");
      }

      const prochaineActivite: ActiviteEleveSauvegardee = {
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        preparedLessonId: fiche.id,
        cycle: fiche.cycle,
        niveau: fiche.niveau || lesson.niveau,
        domaine: fiche.domaine,
        sousDomaine: fiche.sousDomaine,
        item: fiche.item,
        competence: fiche.competence,
        sequenceTitle: fiche.sequenceTitle,
        seanceNumero: fiche.seanceNumero,
        activity: data.activity
      };

      const prochainesActivites = [...activites, prochaineActivite];
      setActivites(prochainesActivites);
      writeUserData(STUDENT_ACTIVITIES_STORAGE_KEY, prochainesActivites);
      setDossierActif("activites");
      setFicheEnModal(null);
      setMessage(`La fiche élève "${data.activity.titre}" a été générée et rangée dans Activités.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Une erreur inconnue est survenue.");
    } finally {
      setActiviteEnCours("");
    }
  }

  async function genererCours(fiche: SeancePreparee, lesson: SeanceDetaillee) {
    setCoursEnCours(fiche.id);
    setMessage("");

    try {
      const aiConfig = readAiConfig();
      const response = await fetch("/api/generate-course", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cycle: fiche.cycle,
          niveau: fiche.niveau || lesson.niveau,
          domaine: fiche.domaine,
          sousDomaine: fiche.sousDomaine,
          item: fiche.item,
          competence: fiche.competence,
          sequenceTitle: fiche.sequenceTitle,
          seanceNumero: fiche.seanceNumero,
          lesson,
          aiProvider: aiConfig?.provider,
          aiApiKey: aiConfig?.apiKey
        })
      });

      const data = (await response.json()) as {
        course?: CoursPresentation;
        error?: string;
      };

      if (!response.ok || !data.course) {
        throw new Error(data.error ?? "Impossible de générer le cours.");
      }

      const prochainCours: CoursSauvegarde = {
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        preparedLessonId: fiche.id,
        cycle: fiche.cycle,
        niveau: fiche.niveau || lesson.niveau,
        domaine: fiche.domaine,
        sousDomaine: fiche.sousDomaine,
        item: fiche.item,
        competence: fiche.competence,
        sequenceTitle: fiche.sequenceTitle,
        seanceNumero: fiche.seanceNumero,
        course: data.course
      };

      const prochainsCours = [...cours, prochainCours];
      setCours(prochainsCours);
      writeUserData(COURSE_PRESENTATIONS_STORAGE_KEY, prochainsCours);
      setDossierActif("cours");
      setFicheEnModal(null);
      setMessage(`Le cours "${data.course.titre}" a été généré et rangé dans Cours.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Une erreur inconnue est survenue.");
    } finally {
      setCoursEnCours("");
    }
  }

  function supprimerSequence(sequence: SequencePreparee) {
    const confirmation = window.confirm(
      `Supprimer la séquence "${sequence.sequence.titre}" et ses fiches de séances associées ?`
    );
    if (!confirmation) return;

    const prochainesSequences = sequences.filter((item) => item.id !== sequence.id);
    const prochainesFiches = fiches.filter(
      (fiche) =>
        !(
          fiche.cycle === sequence.cycle &&
          fiche.niveau === sequence.niveau &&
          fiche.domaine === sequence.domaine &&
          fiche.sousDomaine === sequence.sousDomaine &&
          fiche.sequenceTitle === sequence.sequence.titre
        )
    );

    setSequences(prochainesSequences);
    setFiches(prochainesFiches);
    writeUserData(SEQUENCES_STORAGE_KEY, prochainesSequences);
    writeUserData(PREPARED_LESSONS_STORAGE_KEY, prochainesFiches);
    setMessage(`La séquence "${sequence.sequence.titre}" a été supprimée.`);
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
      <section className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-teal-700">
              Bibliothèque
            </p>
            <h1 className="mt-2 text-3xl font-bold text-slate-950">Explorateur pédagogique</h1>
            <p className="mt-2 max-w-3xl leading-7 text-slate-700">
              Retrouvez les séquences et séances selon l'arborescence Cycle / Niveau / Domaine /
              Sous-domaine / Séquence.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <a href="/" className="rounded-md border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-100">
              Tableau de bord
            </a>
            <a href="/preparation" className="rounded-md border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-100">
              Préparer une séance
            </a>
            <a href="/planning" className="rounded-md bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800">
              Ouvrir le planning
            </a>
          </div>
        </div>

        {message && (
          <div className="mb-5 rounded-md border border-teal-200 bg-teal-50 p-4 text-teal-950">
            {message}
          </div>
        )}

        <div className="mb-6 grid gap-3 md:grid-cols-3">
          {dossiersBibliotheque.map((dossier) => {
            const actif = dossierActif === dossier.id;
            return (
              <button
                key={dossier.id}
                type="button"
                onClick={() => setDossierActif(dossier.id)}
                className={`rounded-lg border p-4 text-left shadow-sm transition ${
                  actif
                    ? "border-teal-300 bg-teal-50 ring-2 ring-teal-100"
                    : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                }`}
              >
                <span className="flex items-start justify-between gap-3">
                  <span className="font-semibold text-slate-950">{dossier.titre}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                      actif ? "bg-teal-700 text-white" : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {dossier.compteur}
                  </span>
                </span>
                <span className="mt-2 block text-sm leading-6 text-slate-600">
                  {dossier.description}
                </span>
              </button>
            );
          })}
        </div>

        {dossierActif === "preparations" && sequences.length === 0 && (
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            Aucune s&eacute;quence enregistr&eacute;e pour le moment.
          </div>
        )}

        {dossierActif === "activites" && (
          <div className="grid gap-4">
            {activites.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-slate-700">
                <h2 className="text-lg font-semibold text-slate-950">Activit&eacute;s</h2>
                <p className="mt-2 leading-7">
                  Les fiches &eacute;l&egrave;ves g&eacute;n&eacute;r&eacute;es depuis une fiche de s&eacute;ance
                  appara&icirc;tront ici.
                </p>
              </div>
            ) : (
              activites.map((activite) => (
                <article
                  key={activite.id}
                  className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">
                        {activite.niveau} · Séance {activite.seanceNumero}
                      </p>
                      <h2 className="mt-1 text-xl font-bold text-slate-950">
                        {activite.activity.titre}
                      </h2>
                      <p className="mt-1 text-sm text-slate-500">
                        {activite.sequenceTitle} · {activite.domaine}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-teal-50 border border-teal-200 px-3 py-1 text-xs font-semibold text-teal-700">
                        Fiche élève
                      </span>
                      <button
                        type="button"
                        onClick={() => setActiviteEnViewer(activite)}
                        className="flex items-center gap-1.5 rounded-md bg-teal-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-800"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <polyline points="6 9 6 2 18 2 18 9"/>
                          <path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/>
                          <rect x="6" y="14" width="12" height="8"/>
                        </svg>
                        Ouvrir / Imprimer
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-4 text-sm leading-6 text-slate-700">
                    <section>
                      <h3 className="font-semibold text-slate-950">Consigne</h3>
                      <p className="mt-1">{activite.activity.consigne}</p>
                    </section>
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {activite.activity.activites.map((item, index) => (
                        <section key={`${activite.id}-${index}`} className="rounded-md bg-slate-50 p-3 border border-slate-100">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="flex-shrink-0 grid h-5 w-5 place-items-center rounded-full bg-slate-200 text-xs font-black text-slate-600">
                              {index + 1}
                            </span>
                            <h3 className="font-semibold text-slate-950 text-xs truncate">{item.titre}</h3>
                          </div>
                          <p className="mt-1 text-xs text-slate-600 line-clamp-2">{item.consigne}</p>
                          <p className="mt-1.5 text-xs font-semibold text-slate-400">
                            {item.format_reponse}
                          </p>
                        </section>
                      ))}
                    </div>
                    {(activite.activity.differenciation.soutien || activite.activity.differenciation.approfondissement) && (
                      <div className="flex flex-wrap gap-2">
                        {activite.activity.differenciation.soutien && (
                          <span className="rounded-full bg-blue-50 border border-blue-200 px-3 py-1 text-xs text-blue-700">
                            Soutien disponible
                          </span>
                        )}
                        {activite.activity.differenciation.approfondissement && (
                          <span className="rounded-full bg-purple-50 border border-purple-200 px-3 py-1 text-xs text-purple-700">
                            Approfondissement disponible
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </article>
              ))
            )}
          </div>
        )}

        {dossierActif === "cours" && (
          <div className="grid gap-4">
            {cours.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-slate-700">
                <h2 className="text-lg font-semibold text-slate-950">Cours</h2>
                <p className="mt-2 leading-7">
                  Les pr&eacute;sentations enseignant g&eacute;n&eacute;r&eacute;es depuis une fiche de s&eacute;ance
                  appara&icirc;tront ici.
                </p>
              </div>
            ) : (
              cours.map((item) => (
                <article
                  key={item.id}
                  className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">
                        {item.niveau} · Séance {item.seanceNumero}
                      </p>
                      <h2 className="mt-1 text-xl font-bold text-slate-950">
                        {item.course.titre}
                      </h2>
                      <p className="mt-1 text-sm text-slate-500">
                        {item.sequenceTitle} · {item.domaine}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-slate-100 border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600">
                        {item.course.slides.length} slides
                      </span>
                      <button
                        type="button"
                        onClick={() => setCoursEnViewer(item)}
                        className="flex items-center gap-1.5 rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-700"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <rect x="2" y="3" width="20" height="14" rx="2"/>
                          <path d="M8 21h8M12 17v4"/>
                        </svg>
                        Projeter
                      </button>
                    </div>
                  </div>

                  {/* Slides preview as a horizontal strip */}
                  <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
                    {item.course.slides.map((slide, index) => (
                      <button
                        key={`${item.id}-${index}`}
                        type="button"
                        onClick={() => { setCoursEnViewer(item); }}
                        className="flex-shrink-0 w-36 rounded-md bg-slate-900 p-3 text-left hover:bg-slate-800 transition"
                      >
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">
                          {index + 1} · {slide.type}
                        </p>
                        <p className="text-xs font-bold text-white leading-snug line-clamp-2">{slide.titre}</p>
                        {slide.contenu[0] && (
                          <p className="mt-1 text-xs text-slate-400 line-clamp-2 leading-snug">{slide.contenu[0]}</p>
                        )}
                      </button>
                    ))}
                  </div>

                  {item.course.deroule_projection && item.course.deroule_projection.length > 0 && (
                    <div className="mt-3 rounded-md bg-slate-50 px-4 py-2 border border-slate-100">
                      <p className="text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wide">Déroulé de projection</p>
                      <ul className="space-y-0.5">
                        {item.course.deroule_projection.map((etape, i) => (
                          <li key={i} className="text-xs leading-5 text-slate-600">→ {etape}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </article>
              ))
            )}
          </div>
        )}

        {dossierActif === "preparations" && (
          <div className="grid gap-4">
          {Object.entries(dossiers).map(([cycle, niveaux]) => (
            <details key={cycle} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <summary className="cursor-pointer text-xl font-bold text-slate-950">{cycle}</summary>

              <div className="mt-4 grid gap-3 pl-4">
                {Object.entries(niveaux).map(([niveau, domaines]) => (
                  <details key={niveau} className="rounded-md bg-slate-50 p-3">
                    <summary className="cursor-pointer font-semibold text-slate-950">{niveau}</summary>

                    <div className="mt-3 grid gap-3 pl-4">
                      {Object.entries(domaines).map(([domaine, sousDomaines]) => {
                        const couleur = getDisciplineColor(domaine);
                        return (
                          <details
                            key={domaine}
                            className="rounded-md border border-l-[6px] p-3"
                            style={{ backgroundColor: couleur.softBackground, borderColor: couleur.border, color: couleur.text }}
                          >
                            <summary className="cursor-pointer font-semibold">{domaine}</summary>

                            <div className="mt-3 grid gap-3 pl-4">
                              {Object.entries(sousDomaines).map(([sousDomaine, listeSequences]) => (
                                <details
                                  key={sousDomaine}
                                  className="rounded-md border bg-white/70 p-3"
                                  style={{ borderColor: getDisciplineColor(domaine).border }}
                                >
                                  <summary className="cursor-pointer font-semibold">{sousDomaine}</summary>

                                  <div className="mt-3 grid gap-3 pl-4">
                                    {listeSequences.map((sequence) => (
                                      <details
                                        key={sequence.id}
                                        className="rounded-md border bg-white p-4"
                                        style={{ borderColor: getDisciplineColor(sequence.domaine).border }}
                                      >
                                        <summary className="grid cursor-pointer grid-cols-[1fr_auto] items-center gap-3">
                                          <span>
                                            <span className="font-semibold text-slate-950">
                                              Séquence · {sequence.sequence.titre}
                                            </span>
                                            <span className="ml-2 text-sm text-slate-500">
                                              {sequence.sequence.seances.length} séance(s)
                                              {sequence.sequence.regime && (
                                                <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                                                  {sequence.sequence.regime}
                                                </span>
                                              )}
                                            </span>
                                          </span>
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.preventDefault();
                                              e.stopPropagation();
                                              supprimerSequence(sequence);
                                            }}
                                            className="rounded-md bg-red-700 px-3 py-2 text-xs font-semibold text-white transition hover:bg-red-800"
                                          >
                                            Supprimer
                                          </button>
                                        </summary>

                                        <div className="mt-4 grid gap-3">
                                          <label className="grid gap-2">
                                            <span className="text-sm font-semibold text-slate-700">
                                              Titre de la séquence
                                            </span>
                                            <input
                                              value={sequence.sequence.titre}
                                              onChange={(e) =>
                                                modifierSequenceSauvegardee(sequence, {
                                                  ...sequence.sequence,
                                                  titre: e.target.value
                                                })
                                              }
                                              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 font-semibold text-slate-950 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                                            />
                                          </label>
                                          <label className="grid gap-2 text-sm leading-6 text-slate-700">
                                            <span className="font-semibold text-slate-950">
                                              Intention générale
                                            </span>
                                            <textarea
                                              value={sequence.sequence.intention}
                                              onChange={(e) =>
                                                modifierSequenceSauvegardee(sequence, {
                                                  ...sequence.sequence,
                                                  intention: e.target.value
                                                })
                                              }
                                              className="min-h-20 w-full rounded-md border border-slate-300 bg-white px-3 py-2 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                                            />
                                          </label>
                                          <p className="mt-2 text-sm leading-6 text-slate-700">
                                            <span className="font-semibold text-slate-950">Objectif :</span>{" "}
                                            {sequence.objectif}
                                          </p>

                                          <details
                                            className="mt-4 rounded-md border p-3"
                                            style={{
                                              backgroundColor: getDisciplineColor(sequence.domaine).softBackground,
                                              borderColor: getDisciplineColor(sequence.domaine).border,
                                              color: getDisciplineColor(sequence.domaine).text
                                            }}
                                            open
                                          >
                                            <summary className="cursor-pointer text-sm font-semibold text-teal-700">
                                              Voir la progression
                                            </summary>

                                            <div className="mt-3 grid gap-3">
                                              {sequence.sequence.seances
                                                .sort((a, b) => a.numero - b.numero)
                                                .map((seance) => {
                                                  const fiche = trouverFiche(fiches, sequence, seance);
                                                  const idPreparation = cleSeance(sequence, seance.numero);
                                                  const estReservee =
                                                    !!fiche &&
                                                    tuilesPlanning.some(
                                                      (tuile) => tuile.preparedLessonId === fiche.id
                                                    );

                                                  return (
                                                    <article
                                                      key={`${sequence.id}-${seance.numero}`}
                                                      className="rounded-md border bg-white p-4"
                                                      style={{ borderColor: getDisciplineColor(sequence.domaine).border }}
                                                    >
                                                      <div className="flex flex-wrap items-start justify-between gap-3">
                                                        <div className="min-w-0 flex-1">
                                                          <label className="grid gap-1">
                                                            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                                              Séance {seance.numero}
                                                            </span>
                                                            <input
                                                              value={seance.titre}
                                                              onChange={(e) =>
                                                                modifierSeanceProgressionSauvegardee(
                                                                  sequence,
                                                                  seance.numero,
                                                                  { titre: e.target.value }
                                                                )
                                                              }
                                                              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 font-semibold text-slate-950 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                                                            />
                                                          </label>
                                                          <p className="mt-1 text-sm font-medium uppercase tracking-wide text-slate-500">
                                                            {seance.type}
                                                            {seance.duree_minutes ? ` · ${seance.duree_minutes} min` : ""}
                                                          </p>
                                                        </div>
                                                        {fiche ? (
                                                          <div className="flex flex-wrap gap-2">
                                                            <button
                                                              type="button"
                                                              onClick={() => setFicheEnModal(fiche)}
                                                              className="rounded-md border border-teal-200 bg-teal-50 px-4 py-2 text-sm font-semibold text-teal-900 transition hover:bg-teal-100"
                                                            >
                                                              Voir la fiche
                                                            </button>
                                                            <button
                                                              type="button"
                                                              onClick={() => renvoyerEnReserve(fiche)}
                                                              disabled={estReservee}
                                                              className="rounded-md bg-teal-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                                                            >
                                                              {estReservee ? "Réservée" : "Envoyer dans la réserve"}
                                                            </button>
                                                          </div>
                                                        ) : (
                                                          <button
                                                            type="button"
                                                            onClick={() => preparerSeance(sequence, seance)}
                                                            disabled={preparationEnCours === idPreparation}
                                                            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-wait disabled:bg-slate-400"
                                                          >
                                                            {preparationEnCours === idPreparation
                                                              ? "Préparation..."
                                                              : "Préparer la séance"}
                                                          </button>
                                                        )}
                                                      </div>

                                                      {seance.beat && (
                                                        <dl className="mt-3 grid gap-2 text-sm text-slate-700">
                                                          <div>
                                                            <dt className="font-semibold text-slate-900">Amorce</dt>
                                                            <dd className="mt-0.5">{seance.beat.amorce}</dd>
                                                          </div>
                                                          <div>
                                                            <dt className="font-semibold text-slate-900">Recherche</dt>
                                                            <dd className="mt-0.5">{seance.beat.recherche}</dd>
                                                          </div>
                                                        </dl>
                                                      )}
                                                    </article>
                                                  );
                                                })}
                                            </div>
                                          </details>
                                        </div>
                                      </details>
                                    ))}
                                  </div>
                                </details>
                              ))}
                            </div>
                          </details>
                        );
                      })}
                    </div>
                  </details>
                ))}
              </div>
            </details>
          ))}
          </div>
        )}
      </section>

      {ficheEnModal && (
        <FicheSeanceModal
          open={!!ficheEnModal}
          lesson={ficheEnModal.lesson}
          onClose={() => setFicheEnModal(null)}
          onSave={(updated) => {
            modifierLessonSauvegardee(ficheEnModal, updated);
            setFicheEnModal({ ...ficheEnModal, lesson: updated });
          }}
          onGenerateStudentActivity={(lesson) => genererActiviteEleve(ficheEnModal, lesson)}
          studentActivityLoading={activiteEnCours === ficheEnModal.id}
          onGenerateCourse={(lesson) => genererCours(ficheEnModal, lesson)}
          courseLoading={coursEnCours === ficheEnModal.id}
          actions={
            <>
              <button
                type="button"
                onClick={() => imprimerFiche(ficheEnModal)}
                className="rounded-md bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-300"
              >
                Imprimer
              </button>
              <button
                type="button"
                onClick={() => {
                  renvoyerEnReserve(ficheEnModal);
                  setFicheEnModal(null);
                }}
                disabled={tuilesPlanning.some((t) => t.preparedLessonId === ficheEnModal.id)}
                className="rounded-md bg-teal-700 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-800 focus:outline-none focus:ring-2 focus:ring-teal-300 disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                {tuilesPlanning.some((t) => t.preparedLessonId === ficheEnModal.id)
                  ? "Réservée"
                  : "Envoyer dans la réserve"}
              </button>
            </>
          }
        />
      )}

      {activiteEnViewer && (
        <FicheEleveViewer
          open={!!activiteEnViewer}
          activite={activiteEnViewer}
          onClose={() => setActiviteEnViewer(null)}
        />
      )}

      {coursEnViewer && (
        <CoursViewer
          open={!!coursEnViewer}
          cours={coursEnViewer}
          onClose={() => setCoursEnViewer(null)}
          onSave={(updatedCourse) => {
            const updated = { ...coursEnViewer, course: updatedCourse };
            const prochainsCours = cours.map((c) => c.id === coursEnViewer.id ? updated : c);
            setCours(prochainsCours);
            writeUserData(COURSE_PRESENTATIONS_STORAGE_KEY, prochainsCours);
            setCoursEnViewer(updated);
          }}
        />
      )}
    </main>
  );
}
