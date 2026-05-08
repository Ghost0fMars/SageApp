"use client";

import { useEffect, useMemo, useState } from "react";
import { getDisciplineColor } from "../lib/discipline-colors";
import { readUserData, writeUserData } from "../lib/user-storage";

type PhaseSeanceDetaillee = {
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
  phases?: PhaseSeanceDetaillee[];
  traceEcrite?: string;
  vigilance?: string;
};

type SeanceProgression = {
  numero: number;
  phase: string;
  titre: string;
  objectif: string;
  activite?: string;
  traceOuProduction?: string;
};

type Sequence = {
  titre: string;
  intention: string;
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
  seancePhase: string;
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

function lireDureeEnMinutes(duree: string) {
  const heures = duree.match(/(\d+)\s*h/i);
  const minutes = duree.match(/(\d+)\s*min/i);
  const totalHeures = heures ? Number(heures[1]) * 60 : 0;
  const totalMinutes = minutes ? Number(minutes[1]) : 0;
  const total = totalHeures + totalMinutes;
  return total > 0 ? total : 55;
}

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
    dureeMinutes: lireDureeEnMinutes(seance.lesson.dureeTotale),
    lesson: seance.lesson
  };

  writeUserData(PLANNING_STORAGE_KEY, [...tuilesExistantes, tuile]);
}

function imprimerFiche(fiche: SeancePreparee) {
  const fenetre = window.open("", "_blank", "width=900,height=700");
  if (!fenetre) return;

  const e = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const phasesHtml = (fiche.lesson.phases ?? [])
    .map(
      (phase, i) => `
      <section class="phase">
        <h2>Phase ${i + 1} — ${e(phase.titre)}</h2>
        <p class="meta">${[phase.duree, phase.organisation].filter(Boolean).map(e).join(" · ")}</p>
        ${phase.roleEnseignant ? `<h3>Rôle enseignant</h3><p>${e(phase.roleEnseignant)}</p>` : ""}
        ${phase.consigne ? `<h3>Consigne</h3><p>${e(phase.consigne)}</p>` : ""}
        ${phase.activiteEleves ? `<h3>Activité élèves</h3><p>${e(phase.activiteEleves)}</p>` : ""}
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
    body {
      font-family: Georgia, "Times New Roman", serif;
      font-size: 11pt;
      line-height: 1.6;
      color: #111;
      padding: 2cm 2.5cm;
    }
    h1 { font-size: 18pt; font-weight: bold; margin-bottom: 4pt; }
    h2 { font-size: 13pt; font-weight: bold; margin: 18pt 0 4pt; border-bottom: 1px solid #ccc; padding-bottom: 3pt; }
    h3 { font-size: 10pt; font-weight: bold; text-transform: uppercase; letter-spacing: .04em; margin: 10pt 0 2pt; color: #444; }
    p { margin-bottom: 6pt; white-space: pre-wrap; }
    .subtitle { font-size: 10pt; color: #555; margin-bottom: 14pt; }
    .meta { font-size: 9pt; color: #666; margin-bottom: 6pt; font-style: italic; }
    .intro { margin-bottom: 16pt; padding-bottom: 12pt; border-bottom: 2px solid #111; }
    .phase { margin-top: 12pt; break-inside: avoid; }
    .section { margin-top: 14pt; break-inside: avoid; }
    @page { margin: 0; }
    @media print { body { padding: 1.5cm 2cm; } }
  </style>
</head>
<body>
  <div class="intro">
    <h1>${e(fiche.lesson.titre)}</h1>
    <p class="subtitle">
      ${[fiche.sequenceTitle, `Séance ${fiche.seanceNumero}`, fiche.seancePhase, fiche.lesson.niveau, fiche.lesson.dureeTotale].filter(Boolean).map(e).join(" · ")}
    </p>
    ${fiche.lesson.objectif ? `<h3>Objectif</h3><p>${e(fiche.lesson.objectif)}</p>` : ""}
    ${fiche.lesson.materielGlobal ? `<h3>Matériel</h3><p>${e(fiche.lesson.materielGlobal)}</p>` : ""}
  </div>
  ${phasesHtml}
  ${fiche.lesson.traceEcrite ? `<div class="section"><h2>Trace écrite</h2><p>${e(fiche.lesson.traceEcrite)}</p></div>` : ""}
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
  const [message, setMessage] = useState("");
  const [preparationEnCours, setPreparationEnCours] = useState("");

  useEffect(() => {
    function chargerDonnees() {
      setSequences(
        readUserData<SequencePreparee[]>(SEQUENCES_STORAGE_KEY, [], SEQUENCES_STORAGE_KEY)
      );
      setFiches(
        readUserData<SeancePreparee[]>(
          PREPARED_LESSONS_STORAGE_KEY,
          [],
          PREPARED_LESSONS_STORAGE_KEY
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

  async function preparerSeance(sequence: SequencePreparee, seance: SeanceProgression) {
    const idPreparation = cleSeance(sequence, seance.numero);
    setPreparationEnCours(idPreparation);
    setMessage("");

    try {
      const response = await fetch("/api/generate-lesson", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
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
        seancePhase: seance.phase,
        lesson: data.seance
      };

      const nouvellesFiches = [...fiches, fiche];
      setFiches(nouvellesFiches);
      writeUserData(PREPARED_LESSONS_STORAGE_KEY, nouvellesFiches);
      setMessage(`La fiche de séance ${seance.numero} a été préparée et enregistrée.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Une erreur inconnue est survenue.");
    } finally {
      setPreparationEnCours("");
    }
  }

  function renvoyerEnReserve(seance: SeancePreparee) {
    if (tuilesPlanning.some((tuile) => tuile.preparedLessonId === seance.id)) {
      return;
    }

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
    const prochainesSequences = sequences.map((sequence) =>
      sequence.id === sequenceOriginale.id ? { ...sequence, sequence: prochaineSequence } : sequence
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
        (fiche) => fiche.id === tuile.preparedLessonId && fiche.sequenceTitle === prochaineSequence.titre
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
    const prochainesFiches = fiches.map((fiche) => (fiche.id === ficheId ? prochaineFiche : fiche));
    const prochainesTuiles = tuilesPlanning.map((tuile) =>
      tuile.preparedLessonId === ficheId
        ? {
            ...tuile,
            titreSequence: prochaineFiche.sequenceTitle,
            domaine: prochaineFiche.domaine,
            dureeMinutes: lireDureeEnMinutes(prochaineFiche.lesson.dureeTotale),
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

  function modifierPhaseLessonSauvegardee(
    fiche: SeancePreparee,
    indexPhase: number,
    miseAJour: Partial<PhaseSeanceDetaillee>
  ) {
    modifierLessonSauvegardee(fiche, {
      ...fiche.lesson,
      phases: fiche.lesson.phases?.map((phase, index) =>
        index === indexPhase ? { ...phase, ...miseAJour } : phase
      )
    });
  }
  function supprimerSequence(sequence: SequencePreparee) {
    const confirmation = window.confirm(
      `Supprimer la séquence "${sequence.sequence.titre}" et ses fiches de séances associées ?`
    );

    if (!confirmation) {
      return;
    }

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
            <a
              href="/"
              className="rounded-md border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-100"
            >
              Tableau de bord
            </a>
            <a
              href="/preparation"
              className="rounded-md border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-100"
            >
              Préparer une séance
            </a>
            <a
              href="/planning"
              className="rounded-md bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
            >
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
              <summary className="cursor-pointer text-xl font-bold text-slate-950">
                {cycle}
              </summary>

              <div className="mt-4 grid gap-3 pl-4">
                {Object.entries(niveaux).map(([niveau, domaines]) => (
                  <details key={niveau} className="rounded-md bg-slate-50 p-3">
                    <summary className="cursor-pointer font-semibold text-slate-950">
                      {niveau}
                    </summary>

                    <div className="mt-3 grid gap-3 pl-4">
                      {Object.entries(domaines).map(([domaine, sousDomaines]) => {
                        const couleurDomaine = getDisciplineColor(domaine);

                        return (
                        <details
                          key={domaine}
                          className="rounded-md border border-l-[6px] p-3"
                          style={{
                            backgroundColor: couleurDomaine.softBackground,
                            borderColor: couleurDomaine.border,
                            color: couleurDomaine.text
                          }}
                        >
                          <summary className="cursor-pointer font-semibold">
                            {domaine}
                          </summary>

                          <div className="mt-3 grid gap-3 pl-4">
                            {Object.entries(sousDomaines).map(([sousDomaine, listeSequences]) => (
                              <details
                                key={sousDomaine}
                                className="rounded-md border bg-white/70 p-3"
                                style={{ borderColor: getDisciplineColor(domaine).border }}
                              >
                                <summary className="cursor-pointer font-semibold">
                                  {sousDomaine}
                                </summary>

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
                                          </span>
                                        </span>
                                        <button
                                          type="button"
                                          onClick={(event) => {
                                            event.preventDefault();
                                            event.stopPropagation();
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
                                            onChange={(event) =>
                                              modifierSequenceSauvegardee(sequence, {
                                                ...sequence.sequence,
                                                titre: event.target.value
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
                                            onChange={(event) =>
                                              modifierSequenceSauvegardee(sequence, {
                                                ...sequence.sequence,
                                                intention: event.target.value
                                              })
                                            }
                                            className="min-h-20 w-full rounded-md border border-slate-300 bg-white px-3 py-2 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                                          />
                                        </label>
                                        <p className="mt-2 text-sm leading-6 text-slate-700">
                                          <span className="font-semibold text-slate-950">
                                            Objectif :
                                          </span>{" "}
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
                                                    (tuile) =>
                                                      tuile.preparedLessonId === fiche.id
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
                                                            onChange={(event) =>
                                                              modifierSeanceProgressionSauvegardee(
                                                                sequence,
                                                                seance.numero,
                                                                { titre: event.target.value }
                                                              )
                                                            }
                                                            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 font-semibold text-slate-950 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                                                          />
                                                        </label>
                                                        <p className="mt-1 text-sm font-medium uppercase tracking-wide text-slate-500">
                                                          {seance.phase}
                                                        </p>
                                                      </div>
                                                      {fiche ? (
                                                        <button
                                                          type="button"
                                                          onClick={() => renvoyerEnReserve(fiche)}
                                                          disabled={estReservee}
                                                          className="rounded-md bg-teal-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                                                        >
                                                          {estReservee
                                                            ? "Réservée"
                                                            : "Envoyer dans la réserve"}
                                                        </button>
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

                                                    <label className="mt-3 grid gap-2 text-sm leading-6 text-slate-800">
                                                      <span className="font-semibold text-slate-950">
                                                        Objectif de séance
                                                      </span>
                                                      <textarea
                                                        value={seance.objectif}
                                                        onChange={(event) =>
                                                          modifierSeanceProgressionSauvegardee(
                                                            sequence,
                                                            seance.numero,
                                                            { objectif: event.target.value }
                                                          )
                                                        }
                                                        className="min-h-20 w-full rounded-md border border-slate-300 bg-white px-3 py-2 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                                                      />
                                                    </label>
                                                    {seance.activite && (
                                                      <label className="mt-2 grid gap-2 text-sm leading-6 text-slate-700">
                                                        <span className="font-semibold text-slate-950">
                                                          Activité
                                                        </span>
                                                        <textarea
                                                          value={seance.activite}
                                                          onChange={(event) =>
                                                            modifierSeanceProgressionSauvegardee(
                                                              sequence,
                                                              seance.numero,
                                                              { activite: event.target.value }
                                                            )
                                                          }
                                                          className="min-h-20 w-full rounded-md border border-slate-300 bg-white px-3 py-2 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                                                        />
                                                      </label>
                                                    )}

                                                    {fiche && (
                                                      <details className="mt-4 rounded-md border border-teal-200 bg-teal-50 p-3">
                                                        <summary className="grid cursor-pointer grid-cols-[1fr_auto] items-center gap-3 text-sm font-semibold text-teal-900">
                                                          <span>Voir la fiche de séance</span>
                                                            <button
                                                              type="button"
                                                              onClick={(event) => {
                                                                event.preventDefault();
                                                                event.stopPropagation();
                                                                imprimerFiche(fiche);
                                                              }}
                                                              className="rounded-md bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-800"
                                                            >
                                                              Imprimer
                                                            </button>
                                                        </summary>
                                                        <div
                                                          id={`fiche-${fiche.id}`}
                                                          className="mt-3 grid gap-3 text-sm leading-6 text-teal-950"
                                                        >
                                                          <label className="grid gap-2">
                                                            <span className="font-semibold">Titre</span>
                                                            <input
                                                              value={fiche.lesson.titre}
                                                              onChange={(event) =>
                                                                modifierLessonSauvegardee(fiche, {
                                                                  ...fiche.lesson,
                                                                  titre: event.target.value
                                                                })
                                                              }
                                                              className="w-full rounded-md border border-teal-200 bg-white px-3 py-2 font-semibold outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                                                            />
                                                          </label>
                                                          <label className="grid gap-2">
                                                            <span className="font-semibold">Objectif</span>
                                                            <textarea
                                                              value={fiche.lesson.objectif}
                                                              onChange={(event) =>
                                                                modifierLessonSauvegardee(fiche, {
                                                                  ...fiche.lesson,
                                                                  objectif: event.target.value
                                                                })
                                                              }
                                                              className="min-h-20 w-full rounded-md border border-teal-200 bg-white px-3 py-2 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                                                            />
                                                          </label>
                                                          <label className="grid gap-2">
                                                            <span className="font-semibold">Durée</span>
                                                            <input
                                                              value={fiche.lesson.dureeTotale}
                                                              onChange={(event) =>
                                                                modifierLessonSauvegardee(fiche, {
                                                                  ...fiche.lesson,
                                                                  dureeTotale: event.target.value
                                                                })
                                                              }
                                                              className="w-full rounded-md border border-teal-200 bg-white px-3 py-2 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                                                            />
                                                          </label>
                                                          <label className="grid gap-2">
                                                            <span className="font-semibold">Matériel</span>
                                                            <textarea
                                                              value={fiche.lesson.materielGlobal}
                                                              onChange={(event) =>
                                                                modifierLessonSauvegardee(fiche, {
                                                                  ...fiche.lesson,
                                                                  materielGlobal: event.target.value
                                                                })
                                                              }
                                                              className="min-h-20 w-full rounded-md border border-teal-200 bg-white px-3 py-2 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                                                            />
                                                          </label>

                                                          {fiche.lesson.phases?.map((phase, index) => (
                                                            <div
                                                              key={`${fiche.id}-${index}-${phase.titre}`}
                                                              className="phase rounded-md border border-teal-200 bg-white p-3"
                                                            >
                                                              <label className="grid gap-2">
                                                                <span className="font-semibold text-slate-950">
                                                                  Phase {index + 1}
                                                                </span>
                                                                <input
                                                                  value={phase.titre}
                                                                  onChange={(event) =>
                                                                    modifierPhaseLessonSauvegardee(fiche, index, {
                                                                      titre: event.target.value
                                                                    })
                                                                  }
                                                                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 font-semibold text-slate-950 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                                                                />
                                                              </label>
                                                              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                                                                <input
                                                                  value={phase.duree}
                                                                  onChange={(event) =>
                                                                    modifierPhaseLessonSauvegardee(fiche, index, {
                                                                      duree: event.target.value
                                                                    })
                                                                  }
                                                                  className="rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-600 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                                                                />
                                                                <input
                                                                  value={phase.organisation}
                                                                  onChange={(event) =>
                                                                    modifierPhaseLessonSauvegardee(fiche, index, {
                                                                      organisation: event.target.value
                                                                    })
                                                                  }
                                                                  className="rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-600 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                                                                />
                                                              </div>
                                                              <label className="mt-2 grid gap-2">
                                                                <span className="font-semibold">Rôle enseignant</span>
                                                                <textarea
                                                                  value={phase.roleEnseignant}
                                                                  onChange={(event) =>
                                                                    modifierPhaseLessonSauvegardee(fiche, index, {
                                                                      roleEnseignant: event.target.value
                                                                    })
                                                                  }
                                                                  className="min-h-20 w-full rounded-md border border-slate-300 bg-white px-3 py-2 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                                                                />
                                                              </label>
                                                              <label className="grid gap-2">
                                                                <span className="font-semibold">Consigne</span>
                                                                <textarea
                                                                  value={phase.consigne}
                                                                  onChange={(event) =>
                                                                    modifierPhaseLessonSauvegardee(fiche, index, {
                                                                      consigne: event.target.value
                                                                    })
                                                                  }
                                                                  className="min-h-20 w-full rounded-md border border-slate-300 bg-white px-3 py-2 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                                                                />
                                                              </label>
                                                              <label className="grid gap-2">
                                                                <span className="font-semibold">Activité élèves</span>
                                                                <textarea
                                                                  value={phase.activiteEleves}
                                                                  onChange={(event) =>
                                                                    modifierPhaseLessonSauvegardee(fiche, index, {
                                                                      activiteEleves: event.target.value
                                                                    })
                                                                  }
                                                                  className="min-h-20 w-full rounded-md border border-slate-300 bg-white px-3 py-2 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                                                                />
                                                              </label>
                                                            </div>
                                                          ))}

                                                          {fiche.lesson.traceEcrite && (
                                                            <label className="grid gap-2">
                                                              <span className="font-semibold">Trace écrite</span>
                                                              <textarea
                                                                value={fiche.lesson.traceEcrite}
                                                                onChange={(event) =>
                                                                  modifierLessonSauvegardee(fiche, {
                                                                    ...fiche.lesson,
                                                                    traceEcrite: event.target.value
                                                                  })
                                                                }
                                                                className="min-h-24 w-full rounded-md border border-teal-200 bg-white px-3 py-2 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                                                              />
                                                            </label>
                                                          )}
                                                          {fiche.lesson.vigilance && (
                                                            <label className="grid gap-2">
                                                              <span className="font-semibold">Vigilance</span>
                                                              <textarea
                                                                value={fiche.lesson.vigilance}
                                                                onChange={(event) =>
                                                                  modifierLessonSauvegardee(fiche, {
                                                                    ...fiche.lesson,
                                                                    vigilance: event.target.value
                                                                  })
                                                                }
                                                                className="min-h-24 w-full rounded-md border border-teal-200 bg-white px-3 py-2 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                                                              />
                                                            </label>
                                                          )}
                                                        </div>
                                                      </details>
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
    </main>
  );
}



