"use client";

import { useEffect, useMemo, useState } from "react";
import referentielBrut from "../../Référentiel_de_compétences.json";
import { readUserData, writeUserData } from "../lib/user-storage";
import { readAiConfig } from "../lib/ai-config";

// TypeScript décrit ici la forme d'une ligne du fichier JSON d'origine.
type LigneReferentielBrute = {
  Cycle: string;
  Niveau: string;
  Domaine: string;
  "Sous-domaine": string;
  Item: string;
  "Compétence": string;
};

// Cette forme simplifiée est celle que l'application utilise ensuite.
type LigneReferentiel = {
  cycle: string;
  niveau: string;
  domaine: string;
  sousDomaine: string;
  item: string;
  competence: string;
};

type EtapeSelection = {
  id: keyof Selection;
  label: string;
  options: string[];
  disabled?: boolean;
};

type Selection = {
  cycle: string;
  niveau: string;
  domaine: string;
  sousDomaine: string;
  item: string;
  competence: string;
};

type Seance = {
  numero: number;
  phase: string;
  titre: string;
  objectif: string;
  activite: string;
  traceOuProduction: string;
};

type Sequence = {
  titre: string;
  intention: string;
  seances: Seance[];
};

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
  phases: PhaseSeanceDetaillee[];
  traceEcrite: string;
  vigilance: string;
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

const PLANNING_STORAGE_KEY = "sage-planning-tiles";
const PREPARED_LESSONS_STORAGE_KEY = "sage-prepared-lessons";
const SEQUENCES_STORAGE_KEY = "sage-sequences";

const selectionVide: Selection = {
  cycle: "",
  niveau: "",
  domaine: "",
  sousDomaine: "",
  item: "",
  competence: ""
};

const libelles: Record<keyof Selection, string> = {
  cycle: "Cycle",
  niveau: "Niveau",
  domaine: "Domaine",
  sousDomaine: "Sous-domaine",
  item: "Item",
  competence: "Compétence"
};

const ordreSelection: Array<keyof Selection> = [
  "cycle",
  "niveau",
  "domaine",
  "sousDomaine",
  "item",
  "competence"
];

function valeursUniques(lignes: LigneReferentiel[], champ: keyof LigneReferentiel) {
  // Set supprime les doublons, puis on trie pour rendre les listes plus lisibles.
  return Array.from(new Set(lignes.map((ligne) => ligne[champ]).filter(Boolean))).sort(
    (a, b) => a.localeCompare(b, "fr")
  );
}

function filtrerReferentiel(
  lignes: LigneReferentiel[],
  selection: Selection,
  jusquA?: keyof Selection
) {
  const limite = jusquA ? ordreSelection.indexOf(jusquA) : ordreSelection.length;

  // On garde seulement les lignes compatibles avec les choix déjà faits.
  return lignes.filter((ligne) =>
    ordreSelection.slice(0, limite).every((champ) => {
      const valeurSelectionnee = selection[champ];
      return !valeurSelectionnee || ligne[champ] === valeurSelectionnee;
    })
  );
}

function reinitialiserApresChamp(selection: Selection, champModifie: keyof Selection) {
  const prochainEtat = { ...selection };
  const indexChampModifie = ordreSelection.indexOf(champModifie);

  // Quand un choix change, les champs suivants doivent être vidés.
  ordreSelection.slice(indexChampModifie + 1).forEach((champ) => {
    prochainEtat[champ] = "";
  });

  return prochainEtat;
}

export default function PageAccueil() {
  const [selection, setSelection] = useState<Selection>(selectionVide);
  const [objectif, setObjectif] = useState("");
  const [sequence, setSequence] = useState<Sequence | null>(null);
  const [sequenceSauvegardeeId, setSequenceSauvegardeeId] = useState("");
  const [seanceDetaillee, setSeanceDetaillee] = useState<SeanceDetaillee | null>(null);
  const [seanceSource, setSeanceSource] = useState<Seance | null>(null);
  const [seancePrepareeId, setSeancePrepareeId] = useState("");
  const [seanceEnReserve, setSeanceEnReserve] = useState(false);
  const [messagePlanning, setMessagePlanning] = useState("");
  const [erreur, setErreur] = useState("");
  const [generationEnCours, setGenerationEnCours] = useState(false);
  const [sequenceEnCours, setSequenceEnCours] = useState(false);
  const [seanceEnCours, setSeanceEnCours] = useState<number | null>(null);

  // useMemo évite de transformer le JSON à chaque affichage de la page.
  const referentiel = useMemo<LigneReferentiel[]>(
    () =>
      (referentielBrut as LigneReferentielBrute[]).map((ligne) => ({
        cycle: ligne.Cycle.trim(),
        niveau: ligne.Niveau.trim(),
        domaine: ligne.Domaine.trim(),
        sousDomaine: ligne["Sous-domaine"].trim(),
        item: ligne.Item.trim(),
        competence: ligne["Compétence"].trim()
      })),
    []
  );

  useEffect(() => {
    function verifierSiSeancePlanifiee() {
      if (!seancePrepareeId) {
        return;
      }

      const tuilesExistantes = readUserData<TuilePlanning[]>(
        PLANNING_STORAGE_KEY,
        [],
        PLANNING_STORAGE_KEY
      );

      setSeanceEnReserve(
        tuilesExistantes.some((tuile) => tuile.preparedLessonId === seancePrepareeId)
      );
    }

    verifierSiSeancePlanifiee();
    window.addEventListener("focus", verifierSiSeancePlanifiee);
    document.addEventListener("visibilitychange", verifierSiSeancePlanifiee);

    return () => {
      window.removeEventListener("focus", verifierSiSeancePlanifiee);
      document.removeEventListener("visibilitychange", verifierSiSeancePlanifiee);
    };
  }, [seancePrepareeId]);

  const etapes: EtapeSelection[] = [
    {
      id: "cycle",
      label: libelles.cycle,
      options: valeursUniques(referentiel, "cycle")
    },
    {
      id: "niveau",
      label: libelles.niveau,
      options: valeursUniques(filtrerReferentiel(referentiel, selection, "niveau"), "niveau"),
      disabled: !selection.cycle
    },
    {
      id: "domaine",
      label: libelles.domaine,
      options: valeursUniques(filtrerReferentiel(referentiel, selection, "domaine"), "domaine"),
      disabled: !selection.niveau
    },
    {
      id: "sousDomaine",
      label: libelles.sousDomaine,
      options: valeursUniques(
        filtrerReferentiel(referentiel, selection, "sousDomaine"),
        "sousDomaine"
      ),
      disabled: !selection.domaine
    },
    {
      id: "item",
      label: libelles.item,
      options: valeursUniques(filtrerReferentiel(referentiel, selection, "item"), "item"),
      disabled: !selection.sousDomaine
    },
    {
      id: "competence",
      label: libelles.competence,
      options: valeursUniques(
        filtrerReferentiel(referentiel, selection, "competence"),
        "competence"
      ),
      disabled: !selection.item
    }
  ];

  function changerSelection(champ: keyof Selection, valeur: string) {
    // On met à jour le champ choisi, puis on remet à zéro les choix dépendants.
    setSelection((selectionActuelle) => ({
      ...reinitialiserApresChamp(selectionActuelle, champ),
      [champ]: valeur
    }));
    setObjectif("");
    setSequence(null);
    setSequenceSauvegardeeId("");
    setSeanceDetaillee(null);
    setSeanceSource(null);
    setSeancePrepareeId("");
    setSeanceEnReserve(false);
    setMessagePlanning("");
    setErreur("");
  }

  async function genererObjectif() {
    if (!selection.competence) {
      setErreur("Sélectionnez d'abord une compétence complète.");
      return;
    }

    setGenerationEnCours(true);
    setErreur("");
    setObjectif("");

    try {
      const aiConfig = readAiConfig();
      const response = await fetch("/api/generate-objective", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          niveau: selection.niveau,
          domaine: selection.domaine,
          competence: selection.competence,
          aiProvider: aiConfig?.provider,
          aiApiKey: aiConfig?.apiKey
        })
      });

      const data = (await response.json()) as { objectif?: string; error?: string };

      if (!response.ok || !data.objectif) {
        throw new Error(data.error ?? "Impossible de générer l'objectif.");
      }

      setObjectif(data.objectif);
      setSequence(null);
      setSequenceSauvegardeeId("");
      setSeanceDetaillee(null);
      setSeanceSource(null);
      setSeancePrepareeId("");
      setSeanceEnReserve(false);
      setMessagePlanning("");
    } catch (error) {
      setErreur(error instanceof Error ? error.message : "Une erreur inconnue est survenue.");
    } finally {
      setGenerationEnCours(false);
    }
  }

  async function genererSequence() {
    if (!objectif) {
      setErreur("Générez d'abord un objectif pédagogique.");
      return;
    }

    setSequenceEnCours(true);
    setErreur("");
    setSequence(null);
    setSequenceSauvegardeeId("");
    setSeanceDetaillee(null);
    setSeanceSource(null);
    setSeancePrepareeId("");
    setSeanceEnReserve(false);
    setMessagePlanning("");

    try {
      const aiConfig = readAiConfig();
      const response = await fetch("/api/generate-sequence", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          cycle: selection.cycle,
          niveau: selection.niveau,
          domaine: selection.domaine,
          sousDomaine: selection.sousDomaine,
          item: selection.item,
          competence: selection.competence,
          objectif,
          aiProvider: aiConfig?.provider,
          aiApiKey: aiConfig?.apiKey
        })
      });

      const data = (await response.json()) as { sequence?: Sequence; error?: string };

      if (!response.ok || !data.sequence) {
        throw new Error(data.error ?? "Impossible de générer la séquence.");
      }

      const sequenceId = crypto.randomUUID();
      setSequence(data.sequence);
      setSequenceSauvegardeeId(sequenceId);
      const sequencesExistantes = readUserData<SequencePreparee[]>(
        SEQUENCES_STORAGE_KEY,
        [],
        SEQUENCES_STORAGE_KEY
      );
      writeUserData(SEQUENCES_STORAGE_KEY, [
        ...sequencesExistantes,
        {
          id: sequenceId,
          createdAt: new Date().toISOString(),
          cycle: selection.cycle,
          niveau: selection.niveau,
          domaine: selection.domaine,
          sousDomaine: selection.sousDomaine,
          item: selection.item,
          competence: selection.competence,
          objectif,
          sequence: data.sequence
        }
      ]);
    } catch (error) {
      setErreur(error instanceof Error ? error.message : "Une erreur inconnue est survenue.");
    } finally {
      setSequenceEnCours(false);
    }
  }

  async function genererSeance(seance: Seance) {
    if (!objectif) {
      setErreur("Générez d'abord un objectif pédagogique.");
      return;
    }

    setSeanceEnCours(seance.numero);
    setErreur("");
    setSeanceDetaillee(null);
    setSeanceSource(null);
    setSeancePrepareeId("");
    setSeanceEnReserve(false);
    setMessagePlanning("");

    try {
      const aiConfig = readAiConfig();
      const response = await fetch("/api/generate-lesson", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          cycle: selection.cycle,
          niveau: selection.niveau,
          domaine: selection.domaine,
          sousDomaine: selection.sousDomaine,
          item: selection.item,
          competence: selection.competence,
          objectifSequence: objectif,
          seance,
          aiProvider: aiConfig?.provider,
          aiApiKey: aiConfig?.apiKey
        })
      });

      const data = (await response.json()) as { seance?: SeanceDetaillee; error?: string };

      if (!response.ok || !data.seance) {
        throw new Error(data.error ?? "Impossible de générer la séance.");
      }

      setSeanceDetaillee(data.seance);
      setSeanceSource(seance);

      if (sequence) {
        const id = crypto.randomUUID();
        const seancePreparee: SeancePreparee = {
          id,
          createdAt: new Date().toISOString(),
          cycle: selection.cycle,
          niveau: selection.niveau,
          domaine: selection.domaine,
          sousDomaine: selection.sousDomaine,
          item: selection.item,
          competence: selection.competence,
          sequenceTitle: sequence.titre,
          sequenceTotal: sequence.seances.length,
          seanceNumero: seance.numero,
          seancePhase: seance.phase,
          lesson: data.seance
        };

        const seancesExistantes = readUserData<SeancePreparee[]>(
          PREPARED_LESSONS_STORAGE_KEY,
          [],
          PREPARED_LESSONS_STORAGE_KEY
        );
        writeUserData(PREPARED_LESSONS_STORAGE_KEY, [...seancesExistantes, seancePreparee]);
        setSeancePrepareeId(id);
      }
    } catch (error) {
      setErreur(error instanceof Error ? error.message : "Une erreur inconnue est survenue.");
    } finally {
      setSeanceEnCours(null);
    }
  }

  function modifierSequence(prochaineSequence: Sequence) {
    setSequence(prochaineSequence);

    if (!sequenceSauvegardeeId) {
      return;
    }

    const sequencesExistantes = readUserData<SequencePreparee[]>(
      SEQUENCES_STORAGE_KEY,
      [],
      SEQUENCES_STORAGE_KEY
    );

    writeUserData(
      SEQUENCES_STORAGE_KEY,
      sequencesExistantes.map((sequenceSauvegardee) =>
        sequenceSauvegardee.id === sequenceSauvegardeeId
          ? { ...sequenceSauvegardee, sequence: prochaineSequence }
          : sequenceSauvegardee
      )
    );
  }

  function modifierSeanceProgression(numero: number, miseAJour: Partial<Seance>) {
    if (!sequence) {
      return;
    }

    modifierSequence({
      ...sequence,
      seances: sequence.seances.map((seance) =>
        seance.numero === numero ? { ...seance, ...miseAJour } : seance
      )
    });
  }

  function modifierSeanceDetaillee(prochaineSeance: SeanceDetaillee) {
    setSeanceDetaillee(prochaineSeance);

    if (!seancePrepareeId) {
      return;
    }

    const seancesExistantes = readUserData<SeancePreparee[]>(
      PREPARED_LESSONS_STORAGE_KEY,
      [],
      PREPARED_LESSONS_STORAGE_KEY
    );
    const tuilesExistantes = readUserData<TuilePlanning[]>(
      PLANNING_STORAGE_KEY,
      [],
      PLANNING_STORAGE_KEY
    );

    writeUserData(
      PREPARED_LESSONS_STORAGE_KEY,
      seancesExistantes.map((seancePreparee) =>
        seancePreparee.id === seancePrepareeId
          ? { ...seancePreparee, lesson: prochaineSeance }
          : seancePreparee
      )
    );
    writeUserData(
      PLANNING_STORAGE_KEY,
      tuilesExistantes.map((tuile) =>
        tuile.preparedLessonId === seancePrepareeId
          ? {
              ...tuile,
              titreSequence: sequence?.titre ?? tuile.titreSequence,
              dureeMinutes: lireDureeEnMinutes(prochaineSeance.dureeTotale),
              lesson: prochaineSeance
            }
          : tuile
      )
    );
  }
  function modifierPhaseSeanceDetaillee(
    indexPhase: number,
    miseAJour: Partial<PhaseSeanceDetaillee>
  ) {
    if (!seanceDetaillee) {
      return;
    }

    modifierSeanceDetaillee({
      ...seanceDetaillee,
      phases: seanceDetaillee.phases.map((phase, index) =>
        index === indexPhase ? { ...phase, ...miseAJour } : phase
      )
    });
  }
  function lireDureeEnMinutes(duree: string) {
    const heures = duree.match(/(\d+)\s*h/i);
    const minutes = duree.match(/(\d+)\s*min/i);

    const totalHeures = heures ? Number(heures[1]) * 60 : 0;
    const totalMinutes = minutes ? Number(minutes[1]) : 0;
    const total = totalHeures + totalMinutes;

    return total > 0 ? total : 55;
  }

  function exporterSeancePdf() {
    if (!seanceDetaillee) {
      return;
    }

    window.print();
  }

  function planifierSeance() {
    if (!seanceDetaillee || !sequence || !seanceSource) {
      setErreur("Préparez d'abord une séance.");
      return;
    }

    if (seanceEnReserve) {
      return;
    }

    const tuile: TuilePlanning = {
      id: crypto.randomUUID(),
      preparedLessonId: seancePrepareeId || undefined,
      titreSequence: sequence.titre,
      seanceLabel: `${seanceSource.numero}/${sequence.seances.length}`,
      domaine: selection.domaine,
      dureeMinutes: lireDureeEnMinutes(seanceDetaillee.dureeTotale),
      lesson: seanceDetaillee
    };

    const tuilesExistantes = readUserData<TuilePlanning[]>(
      PLANNING_STORAGE_KEY,
      [],
      PLANNING_STORAGE_KEY
    );

    writeUserData(PLANNING_STORAGE_KEY, [...tuilesExistantes, tuile]);
    setSeanceEnReserve(true);
    setMessagePlanning("La séance a été envoyée dans la réserve du planning.");
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
      <section className="mx-auto max-w-5xl">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-teal-700">
              Préparer une séquence
            </p>
            <h1 className="mt-2 text-3xl font-bold text-slate-950 sm:text-4xl">
              Sélectionner une compétence
            </h1>
            <p className="mt-3 max-w-2xl text-base leading-7 text-slate-700">
              Choisissez progressivement un cycle, un niveau, un domaine, puis une compétence issue
              des programmes de l'Éducation Nationale.
            </p>
          </div>
          <a
            href="/"
            className="rounded-md border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-300"
          >
            Tableau de bord
          </a>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
          <form className="min-w-0 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="grid gap-4">
              {etapes.map((etape) => (
                <label key={etape.id} className="grid min-w-0 gap-2">
                  <span className="text-sm font-medium text-slate-800">{etape.label}</span>
                  <select
                    value={selection[etape.id]}
                    disabled={etape.disabled}
                    onChange={(evenement) => changerSelection(etape.id, evenement.target.value)}
                    className="min-h-11 w-full min-w-0 max-w-full truncate rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 shadow-sm outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
                  >
                    <option value="">Sélectionner...</option>
                    {etape.options.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
          </form>

          <aside className="min-w-0 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-xl font-semibold text-slate-950">Résultat</h2>

            <div className="mt-4 rounded-md bg-slate-100 p-4">
              <p className="text-sm font-medium text-slate-700">Compétence sélectionnée</p>
              <p className="mt-2 break-words text-base leading-7 text-slate-950">
                {selection.competence || "Aucune compétence sélectionnée pour le moment."}
              </p>
            </div>

            <button
              type="button"
              onClick={genererObjectif}
              disabled={generationEnCours}
              className="mt-5 w-full rounded-md bg-teal-700 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-800 focus:outline-none focus:ring-2 focus:ring-teal-300 disabled:cursor-wait disabled:bg-teal-900/60"
            >
              {generationEnCours ? "Génération..." : "Générer objectif"}
            </button>

            {erreur && (
              <div className="mt-5 rounded-md border border-red-200 bg-red-50 p-4">
                <p className="text-sm font-medium text-red-900">Erreur</p>
                <p className="mt-2 leading-7 text-red-950">{erreur}</p>
              </div>
            )}

            {objectif && (
              <div className="mt-5 rounded-md border border-teal-200 bg-teal-50 p-4">
                <p className="text-sm font-medium text-teal-900">Objectif généré</p>
                <p className="mt-2 leading-7 text-teal-950">{objectif}</p>
              </div>
            )}

            <button
              type="button"
              onClick={genererSequence}
              disabled={!objectif || sequenceEnCours}
              className="mt-5 w-full rounded-md bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-300 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {sequenceEnCours ? "Création de la séquence..." : "Créer la progression de séquence"}
            </button>
          </aside>
        </div>

        {sequence && (
          <section className="mt-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="border-b border-slate-200 pb-4">
              <p className="text-sm font-semibold uppercase tracking-wide text-teal-700">
                Progression de séquence
              </p>
              <label className="mt-2 grid gap-2">
                <span className="text-sm font-semibold text-slate-700">Titre de la séquence</span>
                <input
                  value={sequence.titre}
                  onChange={(event) => modifierSequence({ ...sequence, titre: event.target.value })}
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-2xl font-bold text-slate-950 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                />
              </label>
              <label className="mt-3 grid gap-2">
                <span className="text-sm font-semibold text-slate-700">Intention générale</span>
                <textarea
                  value={sequence.intention}
                  onChange={(event) => modifierSequence({ ...sequence, intention: event.target.value })}
                  className="min-h-24 w-full rounded-md border border-slate-300 bg-white px-3 py-2 leading-7 text-slate-700 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                />
              </label>
            </div>

            <div className="mt-5 grid gap-4">
              {sequence.seances.map((seance) => (
                <article
                  key={`${seance.numero}-${seance.titre}`}
                  className="rounded-md border border-slate-200 bg-slate-50 p-4"
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="rounded-full bg-teal-700 px-3 py-1 text-sm font-semibold text-white">
                      Séance {seance.numero}
                    </span>
                    <span className="text-sm font-semibold uppercase tracking-wide text-slate-600">
                      {seance.phase}
                    </span>
                  </div>

                                    <label className="mt-3 grid gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Titre</span>
                    <input
                      value={seance.titre}
                      onChange={(event) =>
                        modifierSeanceProgression(seance.numero, { titre: event.target.value })
                      }
                      className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-lg font-semibold text-slate-950 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                    />
                  </label>

                  <dl className="mt-3 grid gap-3 text-sm leading-6 text-slate-800">
                    <div>
                      <dt className="font-semibold text-slate-950">Objectif de séance</dt>
                                            <dd>
                        <textarea
                          value={seance.objectif}
                          onChange={(event) =>
                            modifierSeanceProgression(seance.numero, { objectif: event.target.value })
                          }
                          className="mt-1 min-h-20 w-full rounded-md border border-slate-300 bg-white px-3 py-2 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                        />
                      </dd>
                    </div>
                    <div>
                      <dt className="font-semibold text-slate-950">Activité principale</dt>
                                            <dd>
                        <textarea
                          value={seance.activite}
                          onChange={(event) =>
                            modifierSeanceProgression(seance.numero, { activite: event.target.value })
                          }
                          className="mt-1 min-h-20 w-full rounded-md border border-slate-300 bg-white px-3 py-2 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                        />
                      </dd>
                    </div>
                    <div>
                      <dt className="font-semibold text-slate-950">Trace ou production</dt>
                                            <dd>
                        <textarea
                          value={seance.traceOuProduction}
                          onChange={(event) =>
                            modifierSeanceProgression(seance.numero, {
                              traceOuProduction: event.target.value
                            })
                          }
                          className="mt-1 min-h-20 w-full rounded-md border border-slate-300 bg-white px-3 py-2 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                        />
                      </dd>
                    </div>
                  </dl>

                  <button
                    type="button"
                    onClick={() => genererSeance(seance)}
                    disabled={seanceEnCours !== null}
                    className="mt-4 rounded-md bg-teal-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-800 focus:outline-none focus:ring-2 focus:ring-teal-300 disabled:cursor-wait disabled:bg-teal-900/60"
                  >
                    {seanceEnCours === seance.numero
                      ? "Préparation..."
                      : "Préparer cette séance"}
                  </button>
                </article>
              ))}
            </div>
          </section>
        )}

        {seanceDetaillee && (
          <section
            id="seance-a-imprimer"
            className="mt-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm print:border-0 print:shadow-none"
          >
            <div className="border-b border-slate-200 pb-4">
              <p className="text-sm font-semibold uppercase tracking-wide text-teal-700">
                Séance préparée
              </p>
              <label className="mt-2 grid gap-2">
                <span className="text-sm font-semibold text-slate-700">Titre de la séance</span>
                <input
                  value={seanceDetaillee.titre}
                  onChange={(event) =>
                    modifierSeanceDetaillee({ ...seanceDetaillee, titre: event.target.value })
                  }
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-2xl font-bold text-slate-950 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                />
              </label>
              <label className="mt-3 grid gap-2">
                <span className="text-sm font-semibold text-slate-700">Objectif de la séance</span>
                <textarea
                  value={seanceDetaillee.objectif}
                  onChange={(event) =>
                    modifierSeanceDetaillee({ ...seanceDetaillee, objectif: event.target.value })
                  }
                  className="min-h-20 w-full rounded-md border border-slate-300 bg-white px-3 py-2 leading-7 text-slate-700 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                />
              </label>
              <div className="mt-3 flex flex-wrap gap-2 text-sm text-slate-700">
                <label className="grid gap-1 rounded-md bg-slate-100 px-3 py-2">
                  <span className="text-xs font-semibold text-slate-500">Niveau</span>
                  <input
                    value={seanceDetaillee.niveau}
                    onChange={(event) =>
                      modifierSeanceDetaillee({ ...seanceDetaillee, niveau: event.target.value })
                    }
                    className="min-w-0 bg-transparent text-sm font-semibold outline-none"
                  />
                </label>
                <label className="grid gap-1 rounded-md bg-slate-100 px-3 py-2">
                  <span className="text-xs font-semibold text-slate-500">Durée</span>
                  <input
                    value={seanceDetaillee.dureeTotale}
                    onChange={(event) =>
                      modifierSeanceDetaillee({ ...seanceDetaillee, dureeTotale: event.target.value })
                    }
                    className="min-w-0 bg-transparent text-sm font-semibold outline-none"
                  />
                </label>
              </div>
              <label className="mt-3 grid gap-2 text-sm leading-6 text-slate-700">
                <span className="font-semibold text-slate-950">Matériel</span>
                <textarea
                  value={seanceDetaillee.materielGlobal}
                  onChange={(event) =>
                    modifierSeanceDetaillee({ ...seanceDetaillee, materielGlobal: event.target.value })
                  }
                  className="min-h-20 w-full rounded-md border border-slate-300 bg-white px-3 py-2 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                />
              </label>
            </div>

            <div className="mt-5 grid gap-4">
              {seanceDetaillee.phases.map((phase, index) => (
                <article
                  key={`${index}-${phase.titre}`}
                  className="rounded-md border border-slate-200 bg-slate-50 p-4"
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="rounded-full bg-slate-900 px-3 py-1 text-sm font-semibold text-white">
                      Phase {index + 1}
                    </span>
                                        <input
                      value={phase.duree}
                      onChange={(event) =>
                        modifierPhaseSeanceDetaillee(index, { duree: event.target.value })
                      }
                      className="w-24 rounded-md border border-slate-300 bg-white px-2 py-1 text-sm font-medium text-slate-600 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                    />
                    <input
                      value={phase.organisation}
                      onChange={(event) =>
                        modifierPhaseSeanceDetaillee(index, { organisation: event.target.value })
                      }
                      className="min-w-40 flex-1 rounded-md border border-slate-300 bg-white px-2 py-1 text-sm font-medium text-slate-600 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                    />
                  </div>

                                    <label className="mt-3 grid gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Titre de phase</span>
                    <input
                      value={phase.titre}
                      onChange={(event) =>
                        modifierPhaseSeanceDetaillee(index, { titre: event.target.value })
                      }
                      className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-lg font-semibold text-slate-950 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                    />
                  </label>

                  <dl className="mt-3 grid gap-3 text-sm leading-6 text-slate-800">
                    <div>
                      <dt className="font-semibold text-slate-950">Rôle de l'enseignant</dt>
                                            <dd>
                        <textarea
                          value={phase.roleEnseignant}
                          onChange={(event) =>
                            modifierPhaseSeanceDetaillee(index, {
                              roleEnseignant: event.target.value
                            })
                          }
                          className="mt-1 min-h-20 w-full rounded-md border border-slate-300 bg-white px-3 py-2 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                        />
                      </dd>
                    </div>
                    <div>
                      <dt className="font-semibold text-slate-950">Consigne</dt>
                                            <dd>
                        <textarea
                          value={phase.consigne}
                          onChange={(event) =>
                            modifierPhaseSeanceDetaillee(index, { consigne: event.target.value })
                          }
                          className="mt-1 min-h-20 w-full rounded-md border border-slate-300 bg-white px-3 py-2 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                        />
                      </dd>
                    </div>
                    <div>
                      <dt className="font-semibold text-slate-950">Activité des élèves</dt>
                                            <dd>
                        <textarea
                          value={phase.activiteEleves}
                          onChange={(event) =>
                            modifierPhaseSeanceDetaillee(index, {
                              activiteEleves: event.target.value
                            })
                          }
                          className="mt-1 min-h-20 w-full rounded-md border border-slate-300 bg-white px-3 py-2 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                        />
                      </dd>
                    </div>
                    <div>
                      <dt className="font-semibold text-slate-950">Matériel</dt>
                                            <dd>
                        <textarea
                          value={phase.materiel}
                          onChange={(event) =>
                            modifierPhaseSeanceDetaillee(index, { materiel: event.target.value })
                          }
                          className="mt-1 min-h-16 w-full rounded-md border border-slate-300 bg-white px-3 py-2 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                        />
                      </dd>
                    </div>
                  </dl>
                </article>
              ))}
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div className="rounded-md border border-teal-200 bg-teal-50 p-4">
                <label className="grid gap-2">
                  <span className="font-semibold text-teal-950">Trace écrite</span>
                  <textarea
                    value={seanceDetaillee.traceEcrite}
                    onChange={(event) =>
                      modifierSeanceDetaillee({ ...seanceDetaillee, traceEcrite: event.target.value })
                    }
                    className="min-h-28 w-full rounded-md border border-teal-200 bg-white px-3 py-2 leading-7 text-teal-950 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                  />
                </label>
              </div>
              <div className="rounded-md border border-amber-200 bg-amber-50 p-4">
                <label className="grid gap-2">
                  <span className="font-semibold text-amber-950">Vigilance</span>
                  <textarea
                    value={seanceDetaillee.vigilance}
                    onChange={(event) =>
                      modifierSeanceDetaillee({ ...seanceDetaillee, vigilance: event.target.value })
                    }
                    className="min-h-28 w-full rounded-md border border-amber-200 bg-white px-3 py-2 leading-7 text-amber-950 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
                  />
                </label>
              </div>
            </div>

            {messagePlanning && (
              <div className="mt-5 rounded-md border border-teal-200 bg-teal-50 p-4">
                <p className="leading-7 text-teal-950">{messagePlanning}</p>
              </div>
            )}

            <div className="mt-5 flex flex-wrap gap-3 print:hidden">
              <button
                type="button"
                onClick={exporterSeancePdf}
                className="rounded-md bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-300"
              >
                Exporter en PDF
              </button>
              <button
                type="button"
                onClick={planifierSeance}
                disabled={seanceEnReserve}
                className="rounded-md bg-teal-700 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-800 focus:outline-none focus:ring-2 focus:ring-teal-300 disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                {seanceEnReserve ? "Réservée" : "Planifier"}
              </button>
              <a
                href="/planning"
                className="rounded-md border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-300"
              >
                Ouvrir le planning
              </a>
              <a
                href="/bibliotheque"
                className="rounded-md border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-300"
              >
                Voir la bibliothèque
              </a>
            </div>
          </section>
        )}
      </section>
    </main>
  );
}


