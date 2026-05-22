"use client";

import { useEffect, useRef } from "react";

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

type Props = {
  open: boolean;
  activite: {
    sequenceTitle: string;
    seanceNumero: number;
    niveau: string;
    domaine: string;
    activity: FicheActiviteEleve;
  };
  onClose: () => void;
};

const FORMAT_REPONSE_LINES: Record<string, number> = {
  lignes: 4,
  phrase: 2,
  "phrase réponse": 2,
  phrases: 4,
  calculs: 6,
  tableau: 6,
  schéma: 8,
  dessin: 8,
};

function getResponseLines(format: string): number {
  const f = format.toLowerCase();
  for (const [key, lines] of Object.entries(FORMAT_REPONSE_LINES)) {
    if (f.includes(key)) return lines;
  }
  return 3;
}

export default function FicheEleveViewer({ open, activite, onClose }: Props) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (open) {
      window.addEventListener("keydown", onKeyDown);
      document.body.style.overflow = "hidden";
    }
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  function handlePrint() {
    window.print();
  }

  if (!open) return null;

  const { activity, sequenceTitle, seanceNumero, niveau, domaine } = activite;

  return (
    <>
      <style>{`
        @media print {
          body > *:not(#fiche-eleve-print-root) { display: none !important; }
          #fiche-eleve-print-root { position: static !important; background: white !important; }
          .fiche-eleve-modal-overlay { position: static !important; background: none !important; padding: 0 !important; }
          .fiche-eleve-modal-inner { box-shadow: none !important; max-height: none !important; border-radius: 0 !important; }
          .fiche-eleve-no-print { display: none !important; }
          .fiche-eleve-response-area { border: 1px solid #000 !important; background: white !important; }
          .fiche-aide-badge { border: 1px solid #aaa !important; }
        }
      `}</style>
      <div
        id="fiche-eleve-print-root"
        className="fiche-eleve-modal-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        <div
          ref={dialogRef}
          className="fiche-eleve-modal-inner flex flex-col w-full max-w-2xl max-h-[90vh] rounded-2xl bg-white shadow-2xl"
        >
          {/* Toolbar — fixed at top, never scrolls */}
          <div className="fiche-eleve-no-print flex-shrink-0 flex items-center justify-between gap-3 rounded-t-2xl border-b border-slate-200 bg-white px-5 py-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-teal-700">
                Fiche élève
              </span>
              <span className="text-slate-300">·</span>
              <span className="text-xs text-slate-500 truncate max-w-48">{sequenceTitle}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handlePrint}
                className="flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                title="Imprimer / Exporter en PDF"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="6 9 6 2 18 2 18 9"/>
                  <path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/>
                  <rect x="6" y="14" width="12" height="8"/>
                </svg>
                Imprimer
              </button>
              <button
                type="button"
                onClick={onClose}
                className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                aria-label="Fermer"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M6 6l12 12M18 6L6 18"/>
                </svg>
              </button>
            </div>
          </div>

          {/* Fiche content — scrollable zone */}
          <div className="overflow-y-auto flex-1 px-8 pb-10 pt-6 text-slate-900">

            {/* Header strip */}
            <div className="mb-6 border-b-2 border-slate-900 pb-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                    {niveau} · {domaine} · Séance {seanceNumero}
                  </p>
                  <h1 className="mt-1 text-2xl font-black leading-tight text-slate-950">
                    {activity.titre}
                  </h1>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-400">Nom :</p>
                  <div className="mt-1 h-px w-36 bg-slate-900" />
                  <p className="mt-3 text-xs text-slate-400">Prénom :</p>
                  <div className="mt-1 h-px w-36 bg-slate-900" />
                  <p className="mt-3 text-xs text-slate-400">Date :</p>
                  <div className="mt-1 h-px w-36 bg-slate-900" />
                </div>
              </div>

              {/* Objectif */}
              <div className="mt-4 rounded-md bg-slate-50 px-4 py-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Objectif · </span>
                <span className="text-sm leading-6 text-slate-800">{activity.objectif}</span>
              </div>
            </div>

            {/* Support / Situation */}
            {activity.support && (
              <div className="mb-5">
                <h2 className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-400">
                  Support
                </h2>
                <div className="rounded-lg border-2 border-slate-200 bg-slate-50 px-5 py-4">
                  <p className="whitespace-pre-wrap text-sm leading-7 text-slate-800">
                    {activity.support}
                  </p>
                </div>
              </div>
            )}

            {/* Consigne générale */}
            <div className="mb-6 rounded-lg bg-teal-50 px-5 py-3 border border-teal-200">
              <p className="text-xs font-bold uppercase tracking-wide text-teal-600 mb-1">Consigne</p>
              <p className="text-sm leading-7 text-teal-950 font-medium">{activity.consigne}</p>
            </div>

            {/* Activités */}
            <div className="space-y-7">
              {activity.activites.map((item, index) => {
                const lines = getResponseLines(item.format_reponse);
                return (
                  <div key={index}>
                    <div className="mb-2 flex items-baseline gap-3">
                      <span className="flex-shrink-0 grid h-6 w-6 place-items-center rounded-full bg-slate-900 text-xs font-black text-white">
                        {index + 1}
                      </span>
                      <h3 className="text-sm font-bold text-slate-950">{item.titre}</h3>
                    </div>
                    <p className="mb-2 ml-9 text-sm leading-6 text-slate-700">{item.consigne}</p>

                    {/* Aides */}
                    {item.aides && item.aides.length > 0 && (
                      <div className="mb-3 ml-9 flex flex-wrap gap-1.5">
                        {item.aides.map((aide, i) => (
                          <span
                            key={i}
                            className="fiche-aide-badge rounded-full bg-amber-50 px-2.5 py-0.5 text-xs text-amber-800 border border-amber-200"
                          >
                            💡 {aide}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Format réponse label */}
                    <p className="mb-1 ml-9 text-xs font-semibold uppercase tracking-wide text-slate-400">
                      {item.format_reponse}
                    </p>

                    {/* Response area */}
                    <div
                      className="fiche-eleve-response-area ml-9 rounded-md border border-dashed border-slate-300 bg-slate-50"
                      style={{ minHeight: `${lines * 2}rem` }}
                    >
                      {/* Lined paper effect */}
                      <div className="p-2" style={{ backgroundImage: "repeating-linear-gradient(to bottom, transparent, transparent calc(2rem - 1px), #e2e8f0 calc(2rem - 1px), #e2e8f0 2rem)", backgroundSize: "100% 2rem", minHeight: `${lines * 2}rem` }} />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Différenciation — for teacher reference when printing multiple versions */}
            {(activity.differenciation.soutien || activity.differenciation.approfondissement) && (
              <div className="mt-8 grid grid-cols-2 gap-4 border-t border-slate-200 pt-5">
                {activity.differenciation.soutien && (
                  <div className="rounded-lg bg-blue-50 p-3 border border-blue-200">
                    <p className="text-xs font-bold uppercase tracking-wide text-blue-600 mb-1">
                      Soutien
                    </p>
                    <p className="text-xs leading-5 text-blue-900">
                      {activity.differenciation.soutien}
                    </p>
                  </div>
                )}
                {activity.differenciation.approfondissement && (
                  <div className="rounded-lg bg-purple-50 p-3 border border-purple-200">
                    <p className="text-xs font-bold uppercase tracking-wide text-purple-600 mb-1">
                      Approfondissement
                    </p>
                    <p className="text-xs leading-5 text-purple-900">
                      {activity.differenciation.approfondissement}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
