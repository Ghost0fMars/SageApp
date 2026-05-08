"use client";

import { useEffect, useMemo, useState } from "react";
import { getDisciplineColor } from "../lib/discipline-colors";
import { readUserData, writeUserData } from "../lib/user-storage";
import FicheSeanceModal, { type SeanceDetaillee } from "../components/FicheSeanceModal";

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

const PREPARED_LESSONS_STORAGE_KEY = "sage-prepared-lessons";
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
  const [tuilesPlanning, setTuilesPlanning] = useState<TuilePlanning[]>([]);
  const [ficheEnModal, setFicheEnModal] = useState<SeancePreparee | null>(null);
  const [message, setMessage] = useState("");
  const [preparationEnCours, setPreparationEnCours] = useState("");

  useEffect(() => {
    function chargerDonnees() {
      setSequences(
        readUserData<SequencePreparee[]>(SEQUENCES_STORAGE_KEY, [], SEQUENCES_STORAGE_KEY)
      );
      setFiches(
        readUserData<SeancePreparee[]>(PREPARED_LESSONS_STORAGE_KEY, [], PREPARED_LESSONS_STORAGE_KEY)
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

  async function preparerSeance(sequence: SequencePreparee, seance: SeanceProgression) {
    const idPreparation = cleSeance(sequence, seance.numero);
    setPreparationEnCours(idPreparation);
    setMessage("");

    try {
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
          seance
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

        {sequences.length === 0 && (
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            Aucune séquence enregistrée pour le moment.
          </div>
        )}

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
    </main>
  );
}
