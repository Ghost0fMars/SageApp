"use client";

import { DragEvent, useEffect, useMemo, useState } from "react";
import { readUserData, writeUserData } from "../lib/user-storage";
import { getDisciplineColor } from "../lib/discipline-colors";

type SeanceDetaillee = {
  titre: string;
  objectif: string;
  niveau: string;
  duree_minutes: number;
  materiel: string[];
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
  date?: string;
  startMinute?: number;
};

type ZoneCognitive = {
  id: string;
  day: string;
  date: string;
  startMinute: number;
  dureeMinutes: number;
  domaine: string;
  titre: string;
  intention: string;
};

const STORAGE_KEY = "sage-planning-tiles";
const ZONES_STORAGE_KEY = "sage-planning-cognitive-zones";
const jours = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi"];
const debutJournee = 8 * 60;
const finJournee = 17 * 60;
const pasMinutes = 5;
const hauteurTranche = 12;
const nombreTranches = (finJournee - debutJournee) / pasMinutes;

function formatDateInput(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function lundiDeLaSemaine(date: Date) {
  const copie = new Date(date);
  const jour = copie.getDay();
  const decalage = jour === 0 ? -6 : 1 - jour;
  copie.setDate(copie.getDate() + decalage);
  copie.setHours(0, 0, 0, 0);
  return copie;
}

function datesDeLaSemaine(lundi: string) {
  const dateLundi = new Date(`${lundi}T00:00:00`);
  return jours.map((jour, index) => {
    const date = new Date(dateLundi);
    date.setDate(dateLundi.getDate() + index);
    return {
      jour,
      date: formatDateInput(date),
      label: date.toLocaleDateString("fr-FR", {
        day: "2-digit",
        month: "2-digit"
      })
    };
  });
}

function lireTuiles() {
  return readUserData<TuilePlanning[]>(STORAGE_KEY, [], STORAGE_KEY);
}

function lireZonesCognitives() {
  return readUserData<ZoneCognitive[]>(ZONES_STORAGE_KEY, [], ZONES_STORAGE_KEY);
}

function formatHeure(minutesDepuisMinuit: number) {
  const heures = Math.floor(minutesDepuisMinuit / 60);
  const minutes = minutesDepuisMinuit % 60;
  return `${heures.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
}

function libelleDuree(minutes: number) {
  return minutes + " min";
}

function genererZonesCognitives(joursSemaine: ReturnType<typeof datesDeLaSemaine>) {
  const modeles = [
    { day: "Lundi", zones: [[525, 20, "Français", "Mise en route", "Rituels, oral, rappel"], [545, 45, "Français", "Lecture / écriture", "Pic attentionnel pour les fondamentaux"], [590, 45, "Mathématiques", "Résolution / calcul", "Deuxième temps cognitif fort"], [650, 40, "Français", "Étude de la langue", "Retour au cognitif après respiration"], [810, 60, "Arts plastiques", "Temps créatif", "Creux post-méridien : activité moins abstraite"], [900, 60, "Sciences et technologie", "Ateliers / manipulation", "Second plateau attentionnel"], [960, 45, "Enseignement moral et civique", "Synthèse / vie de classe", "Fin de journée plus légère"]] },
    { day: "Mardi", zones: [[525, 20, "Français", "Rituels de lecture", "Entrée progressive"], [545, 45, "Mathématiques", "Recherche / raisonnement", "Créneau cognitif fort"], [590, 45, "Français", "Production d'écrit", "Fondamental placé le matin"], [650, 40, "Éducation physique et sportive", "Respiration motrice", "Alternance effort / mouvement"], [810, 60, "Questionner le monde", "Projet / observation", "Après-midi concret"], [900, 60, "Arts plastiques", "Création", "Activité expressive"], [960, 45, "Langues vivantes", "Oral / jeux", "Fin de journée interactive"]] },
    { day: "Mercredi", zones: [[525, 25, "Français", "Réactivation", "Consolider sans surcharge"], [550, 45, "Mathématiques", "Entraînement", "Matinée courte de consolidation"], [595, 45, "Français", "Lecture compréhension", "Fondamental maintenu le matin"], [650, 40, "Enseignement moral et civique", "Bilan / coopération", "Clôture plus légère"]] },
    { day: "Jeudi", zones: [[525, 20, "Français", "Mise en route", "Rituels stabilisants"], [545, 45, "Français", "Lecture / écriture", "Troisième matinée forte"], [590, 45, "Mathématiques", "Problèmes", "Créneau de raisonnement"], [650, 40, "Éducation physique et sportive", "Respiration", "Bénéfice attentionnel"], [810, 60, "Éducation musicale", "Écoute / pratique", "Activité sensible après déjeuner"], [900, 60, "Histoire et géographie", "Document / récit", "Cognitif modéré"], [960, 45, "Sciences et technologie", "Manipulation courte", "Fin de journée concrète"]] },
    { day: "Vendredi", zones: [[525, 20, "Français", "Rituels", "Matinée intermédiaire"], [545, 45, "Mathématiques", "Réinvestissement", "Fondamental placé le matin"], [590, 45, "Français", "Bilan / écriture", "Consolidation"], [650, 40, "Langues vivantes", "Oral", "Transition plus légère"], [810, 60, "Arts plastiques", "Projet", "Après-midi créatif"], [900, 60, "Éducation physique et sportive", "Activité motrice", "Mobilisation sans surcharge"], [960, 45, "Enseignement moral et civique", "Bilan hebdomadaire", "Clôture de semaine"]] }
  ] as const;

  return modeles.flatMap((modele) => {
    const jour = joursSemaine.find((item) => item.jour === modele.day);
    if (!jour) {
      return [];
    }

    return modele.zones.map(([startMinute, dureeMinutes, domaine, titre, intention], index) => ({
      id: jour.date + "-" + modele.day + "-" + index,
      day: modele.day,
      date: jour.date,
      startMinute,
      dureeMinutes,
      domaine,
      titre,
      intention
    }));
  });
}

export default function PlanningPage() {
  const [tuiles, setTuiles] = useState<TuilePlanning[]>([]);
  const [zonesCognitives, setZonesCognitives] = useState<ZoneCognitive[]>([]);
  const [afficherZones, setAfficherZones] = useState(true);
  const [tuileSelectionneeId, setTuileSelectionneeId] = useState("");
  const [semaineDebut, setSemaineDebut] = useState(() => formatDateInput(lundiDeLaSemaine(new Date())));
  const joursAvecDates = useMemo(() => datesDeLaSemaine(semaineDebut), [semaineDebut]);

  const heures = useMemo(
    () =>
      Array.from({ length: 10 }, (_, index) => {
        const heure = 8 + index;
        return {
          label: `${heure.toString().padStart(2, "0")}:00`,
          top: (heure * 60 - debutJournee) / pasMinutes
        };
      }),
    []
  );

  useEffect(() => {
    const tuilesAvecDates = lireTuiles().map((tuile) => {
        if (!tuile.day || tuile.date) {
          return tuile;
        }

        const dateDuJour = joursAvecDates.find((jour) => jour.jour === tuile.day)?.date;
        return {
          ...tuile,
          date: dateDuJour
        };
      });

    setTuiles(tuilesAvecDates);
    setZonesCognitives(lireZonesCognitives());
    writeUserData(STORAGE_KEY, tuilesAvecDates);
  }, [joursAvecDates]);

  function enregistrer(nouvellesTuiles: TuilePlanning[]) {
    setTuiles(nouvellesTuiles);
    writeUserData(STORAGE_KEY, nouvellesTuiles);
  }

  function commencerGlisser(event: DragEvent, id: string) {
    event.dataTransfer.setData("text/plain", id);
    event.dataTransfer.effectAllowed = "move";
  }

  function deposerDansJour(event: DragEvent<HTMLDivElement>, jour: string, date: string) {
    event.preventDefault();
    const id = event.dataTransfer.getData("text/plain");
    const rectangle = event.currentTarget.getBoundingClientRect();
    const positionY = Math.max(0, event.clientY - rectangle.top);
    const tranche = Math.round(positionY / hauteurTranche);
    const startMinute = Math.min(
      finJournee - pasMinutes,
      debutJournee + tranche * pasMinutes
    );

    enregistrer(
      tuiles.map((tuile) =>
        tuile.id === id
          ? {
              ...tuile,
              day: jour,
              date,
              startMinute
            }
          : tuile
      )
    );
  }

  function remettreEnReserve(id: string) {
    enregistrer(
      tuiles.map((tuile) =>
        tuile.id === id
          ? {
              ...tuile,
              day: undefined,
              date: undefined,
              startMinute: undefined
            }
          : tuile
      )
    );
  }

  function supprimerTuile(id: string) {
    enregistrer(tuiles.filter((tuile) => tuile.id !== id));
    if (tuileSelectionneeId === id) {
      setTuileSelectionneeId("");
    }
  }

  function creerReperesCognitifs() {
    const nouvellesZones = genererZonesCognitives(joursAvecDates);
    setZonesCognitives(nouvellesZones);
    writeUserData(ZONES_STORAGE_KEY, nouvellesZones);
    setAfficherZones(true);
  }

  function effacerReperesCognitifs() {
    setZonesCognitives([]);
    writeUserData(ZONES_STORAGE_KEY, []);
  }

  const tuilesReserve = tuiles.filter((tuile) => !tuile.day);
  const tuileSelectionnee = tuiles.find((tuile) => tuile.id === tuileSelectionneeId);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
      <section className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-teal-700">
              Planning
            </p>
            <h1 className="mt-2 text-3xl font-bold text-slate-950">Organiser la semaine</h1>
            <p className="mt-2 max-w-2xl leading-7 text-slate-700">
              Glissez les séances depuis la réserve vers le planning. Une tranche représente 5
              minutes.
            </p>
            <label className="mt-4 grid max-w-xs gap-2">
              <span className="text-sm font-semibold text-slate-800">Semaine du lundi</span>
              <input
                type="date"
                value={semaineDebut}
                onChange={(event) => setSemaineDebut(formatDateInput(lundiDeLaSemaine(new Date(`${event.target.value}T00:00:00`))))}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
              />
            </label>
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" onClick={creerReperesCognitifs} className="rounded-md bg-teal-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-800">
                Générer les repères cognitifs
              </button>
              <button type="button" onClick={() => setAfficherZones((value) => !value)} className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-100">
                {afficherZones ? "Masquer les repères" : "Afficher les repères"}
              </button>
              <button type="button" onClick={effacerReperesCognitifs} className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-100">
                Effacer
              </button>
            </div>
          </div>

        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <section className="min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="grid w-full min-w-0 grid-cols-[56px_repeat(5,minmax(0,1fr))]">
              <div />
              {joursAvecDates.map(({ jour, label }) => (
                <div
                  key={jour}
                  className="truncate border-b border-slate-200 px-1 pb-3 text-center text-sm font-semibold text-slate-950"
                >
                  <span>{jour}</span>
                  <span className="block text-xs font-medium text-slate-500">{label}</span>
                </div>
              ))}

              <div
                className="relative border-r border-slate-200"
                style={{ height: nombreTranches * hauteurTranche }}
              >
                {heures.map((heure) => (
                  <div
                    key={heure.label}
                    className="absolute left-0 right-1 -translate-y-2 text-right text-[11px] text-slate-500"
                    style={{ top: heure.top * hauteurTranche }}
                  >
                    {heure.label}
                  </div>
                ))}
              </div>

              {joursAvecDates.map(({ jour, date }) => (
                <div
                  key={jour}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => deposerDansJour(event, jour, date)}
                  className="relative border-b border-r border-slate-200 bg-[linear-gradient(to_bottom,#e2e8f0_1px,transparent_1px)]"
                  style={{
                    height: nombreTranches * hauteurTranche,
                    backgroundSize: `100% ${hauteurTranche}px`
                  }}
                >
                  {afficherZones && zonesCognitives
                    .filter((zone) => zone.date === date && zone.day === jour)
                    .map((zone) => {
                      const top = ((zone.startMinute - debutJournee) / pasMinutes) * hauteurTranche;
                      const height = Math.max(hauteurTranche, (zone.dureeMinutes / pasMinutes) * hauteurTranche);
                      const couleur = getDisciplineColor(zone.domaine);

                      return (
                        <div
                          key={zone.id}
                          className="pointer-events-none absolute left-1 right-1 overflow-hidden rounded-md border border-dashed px-1.5 py-1 text-[10px]"
                          style={{
                            top,
                            height,
                            backgroundColor: couleur.softBackground,
                            borderColor: couleur.border,
                            color: couleur.text,
                            opacity: 0.72
                          }}
                          title={zone.intention}
                        >
                          <p className="truncate font-bold">{zone.titre}</p>
                          <p className="truncate">{zone.domaine}</p>
                        </div>
                      );
                    })}

                  {tuiles
                    .filter(
                      (tuile) =>
                        tuile.date === date &&
                        tuile.day === jour &&
                        tuile.startMinute !== undefined
                    )
                    .map((tuile) => {
                      const top =
                        ((tuile.startMinute ?? debutJournee) - debutJournee) /
                        pasMinutes *
                        hauteurTranche;
                      const height = Math.max(
                        hauteurTranche,
                        (tuile.dureeMinutes / pasMinutes) * hauteurTranche
                      );

                      return (
                        <div
                          key={tuile.id}
                          draggable
                          onClick={() => setTuileSelectionneeId(tuile.id)}
                          onDragStart={(event) => commencerGlisser(event, tuile.id)}
                          className={`absolute left-1 right-1 cursor-move overflow-hidden rounded-md border p-1.5 text-white shadow-sm ${
                            tuileSelectionneeId === tuile.id ? "ring-2 ring-slate-950" : ""
                          }`}
                          style={{
                            top,
                            height,
                            backgroundColor: getDisciplineColor(tuile.domaine).background,
                            borderColor: getDisciplineColor(tuile.domaine).border
                          }}
                        >
                          <p className="truncate text-[11px] font-semibold">
                            {tuile.titreSequence}
                          </p>
                          <p className="truncate text-[11px]">Séance {tuile.seanceLabel}</p>
                          <p className="truncate text-[11px]">{tuile.domaine}</p>
                          <p className="truncate text-[11px]">
                            {formatHeure(tuile.startMinute ?? debutJournee)} ·{" "}
                            {libelleDuree(tuile.dureeMinutes)}
                          </p>
                        </div>
                      );
                    })}
                </div>
              ))}
            </div>
          </section>

          <aside className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-xl font-semibold text-slate-950">Réserve</h2>
            <p className="mt-2 text-sm leading-6 text-slate-700">
              Les séances envoyées depuis le formulaire arrivent ici avant d'être placées.
            </p>

            <div className="mt-4 grid gap-3">
              {tuilesReserve.length === 0 && (
                <p className="rounded-md bg-slate-100 p-3 text-sm text-slate-700">
                  Aucune séance en réserve.
                </p>
              )}

              {tuilesReserve.map((tuile) => (
                <div
                  key={tuile.id}
                  draggable
                  onClick={() => setTuileSelectionneeId(tuile.id)}
                  onDragStart={(event) => commencerGlisser(event, tuile.id)}
                  className={`cursor-move rounded-md border border-l-[6px] p-3 text-sm shadow-sm ${
                    tuileSelectionneeId === tuile.id ? "ring-2 ring-slate-950" : ""
                  }`}
                  style={{
                    backgroundColor: getDisciplineColor(tuile.domaine).softBackground,
                    borderColor: getDisciplineColor(tuile.domaine).border,
                    color: getDisciplineColor(tuile.domaine).text
                  }}
                >
                  <p className="font-semibold">{tuile.titreSequence}</p>
                  <p className="mt-1">Séance {tuile.seanceLabel}</p>
                  <p>{tuile.domaine}</p>
                  <p>{libelleDuree(tuile.dureeMinutes)}</p>
                </div>
              ))}
            </div>

            <div className="mt-6 rounded-md border border-slate-200 bg-slate-50 p-4">
              <h3 className="font-semibold text-slate-950">Actions</h3>
              {tuileSelectionnee ? (
                <div className="mt-3">
                  <p className="text-sm font-semibold text-slate-950">
                    {tuileSelectionnee.titreSequence}
                  </p>
                  <p className="mt-1 text-sm text-slate-700">
                    Séance {tuileSelectionnee.seanceLabel} ·{" "}
                    {libelleDuree(tuileSelectionnee.dureeMinutes)}
                  </p>
                  <div className="mt-4 grid gap-2">
                    {tuileSelectionnee.day && (
                      <button
                        type="button"
                        onClick={() => remettreEnReserve(tuileSelectionnee.id)}
                        className="rounded-md bg-teal-700 px-3 py-2 text-sm font-semibold text-white transition hover:bg-teal-800"
                      >
                        Remettre en réserve
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => supprimerTuile(tuileSelectionnee.id)}
                      className="rounded-md bg-red-700 px-3 py-2 text-sm font-semibold text-white transition hover:bg-red-800"
                    >
                      Supprimer la tuile
                    </button>
                  </div>
                </div>
              ) : (
                <p className="mt-2 text-sm leading-6 text-slate-700">
                  Sélectionnez une tuile pour afficher ses actions.
                </p>
              )}
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}









