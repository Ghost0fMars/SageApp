"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

type SlideMedia = {
  type: "image" | "youtube";
  src: string; // URL, base64 data URL, or YouTube video ID
  legende?: string;
  position: "dessus" | "gauche" | "droite" | "fond";
};

type Slide = {
  titre: string;
  type: string;
  contenu: string[];
  notes_enseignant: string;
  interaction: string;
  media?: SlideMedia;
};

type CoursPresentation = {
  titre: string;
  niveau: string;
  objectif: string;
  slides: Slide[];
  deroule_projection: string[];
  materiel: string[];
};

type Props = {
  open: boolean;
  cours: {
    sequenceTitle: string;
    seanceNumero: number;
    niveau: string;
    domaine: string;
    course: CoursPresentation;
  };
  onClose: () => void;
  onSave?: (updatedCourse: CoursPresentation) => void;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const SLIDE_TYPE_LABELS: Record<string, { label: string; bg: string; text: string; accent: string }> = {
  accroche:              { label: "Accroche",              bg: "bg-amber-950",  text: "text-amber-100",  accent: "text-amber-400"  },
  recherche:             { label: "Recherche",             bg: "bg-slate-950",  text: "text-slate-100",  accent: "text-teal-400"   },
  mise_en_commun:        { label: "Mise en commun",        bg: "bg-blue-950",   text: "text-blue-100",   accent: "text-blue-300"   },
  institutionnalisation: { label: "Institutionnalisation", bg: "bg-teal-950",   text: "text-teal-100",   accent: "text-teal-300"   },
  entrainement:          { label: "Entraînement",          bg: "bg-green-950",  text: "text-green-100",  accent: "text-green-400"  },
  synthese:              { label: "Synthèse",              bg: "bg-purple-950", text: "text-purple-100", accent: "text-purple-300" },
};

const DEFAULT_STYLE = { label: "Cours", bg: "bg-slate-900", text: "text-white", accent: "text-slate-300" };

function getSlideStyle(type: string) {
  return SLIDE_TYPE_LABELS[type] ?? DEFAULT_STYLE;
}

function emptySlide(): Slide {
  return { titre: "Nouvelle diapositive", type: "cours", contenu: [], notes_enseignant: "", interaction: "" };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractYoutubeId(url: string): string | null {
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&?/\s]{11})/);
  return match ? match[1] : null;
}

function youtubeThumbnail(id: string) {
  return `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
}

async function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const MAX_W = 1400;
        const MAX_H = 900;
        let { width: w, height: h } = img;
        if (w > MAX_W) { h = Math.round(h * MAX_W / w); w = MAX_W; }
        if (h > MAX_H) { w = Math.round(w * MAX_H / h); h = MAX_H; }
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.75));
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
}

// ─── MediaEditor (used inside EditMode) ───────────────────────────────────────

function MediaEditor({
  media,
  onChange,
}: {
  media: SlideMedia | undefined;
  onChange: (m: SlideMedia | undefined) => void;
}) {
  const [tab, setTab] = useState<"image" | "youtube">(media?.type ?? "image");
  const [urlInput, setUrlInput] = useState(
    media?.type === "image" && !media.src.startsWith("data:") ? media.src : ""
  );
  const [ytInput, setYtInput] = useState(
    media?.type === "youtube" ? media.src : ""
  );
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const ytId = extractYoutubeId(ytInput);

  function applyImageUrl() {
    if (!urlInput.trim()) return;
    onChange({
      type: "image",
      src: urlInput.trim(),
      legende: media?.legende ?? "",
      position: media?.position ?? "dessus",
    });
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const dataUrl = await compressImage(file);
      onChange({
        type: "image",
        src: dataUrl,
        legende: media?.legende ?? "",
        position: media?.position ?? "dessus",
      });
    } finally {
      setUploading(false);
    }
  }

  function applyYoutube() {
    if (!ytId) return;
    onChange({
      type: "youtube",
      src: ytId,
      legende: media?.legende ?? "",
      position: media?.position ?? "dessus",
    });
  }

  const hasMedia = !!media;

  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-4 space-y-4">
      {/* Tab bar */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setTab("image")}
          className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition ${
            tab === "image" ? "bg-white/20 text-white" : "text-white/40 hover:text-white/70"
          }`}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
          Image
        </button>
        <button
          type="button"
          onClick={() => setTab("youtube")}
          className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition ${
            tab === "youtube" ? "bg-white/20 text-white" : "text-white/40 hover:text-white/70"
          }`}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          YouTube
        </button>
        {hasMedia && (
          <button
            type="button"
            onClick={() => onChange(undefined)}
            className="ml-auto flex items-center gap-1 rounded-md px-2 py-1 text-xs text-red-400/70 transition hover:bg-red-950 hover:text-red-300"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M6 6l12 12M18 6L6 18"/></svg>
            Supprimer
          </button>
        )}
      </div>

      {/* Image tab */}
      {tab === "image" && (
        <div className="space-y-3">
          {/* Current image preview */}
          {media?.type === "image" && (
            <div className="relative overflow-hidden rounded-lg">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={media.src}
                alt="aperçu"
                className="h-32 w-full object-contain bg-white/5 rounded-lg"
              />
            </div>
          )}

          {/* URL input */}
          <div>
            <label className="mb-1.5 block text-xs text-white/40">URL d'une image</label>
            <div className="flex gap-2">
              <input
                type="url"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && applyImageUrl()}
                placeholder="https://…"
                className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white placeholder-white/20 focus:border-teal-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={applyImageUrl}
                disabled={!urlInput.trim()}
                className="rounded-lg border border-white/20 px-3 py-1.5 text-xs text-white/60 transition hover:bg-white/10 hover:text-white disabled:opacity-30"
              >
                OK
              </button>
            </div>
          </div>

          {/* File upload */}
          <div>
            <label className="mb-1.5 block text-xs text-white/40">Ou importer un fichier</label>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-2 rounded-lg border border-dashed border-white/20 px-4 py-2 text-xs text-white/50 transition hover:border-white/40 hover:text-white/80 disabled:opacity-40"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>
              {uploading ? "Compression…" : "Choisir une image…"}
            </button>
          </div>
        </div>
      )}

      {/* YouTube tab */}
      {tab === "youtube" && (
        <div className="space-y-3">
          {media?.type === "youtube" && (
            <div className="relative overflow-hidden rounded-lg">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={youtubeThumbnail(media.src)}
                alt="aperçu YouTube"
                className="h-32 w-full object-cover rounded-lg"
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="rounded-full bg-black/60 p-3">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                </div>
              </div>
            </div>
          )}
          <div>
            <label className="mb-1.5 block text-xs text-white/40">URL de la vidéo YouTube</label>
            <div className="flex gap-2">
              <input
                type="url"
                value={ytInput}
                onChange={(e) => setYtInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && applyYoutube()}
                placeholder="https://youtube.com/watch?v=…"
                className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white placeholder-white/20 focus:border-teal-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={applyYoutube}
                disabled={!ytId}
                className="rounded-lg border border-white/20 px-3 py-1.5 text-xs text-white/60 transition hover:bg-white/10 hover:text-white disabled:opacity-30"
              >
                OK
              </button>
            </div>
            {ytInput && !ytId && (
              <p className="mt-1 text-xs text-red-400/70">URL YouTube non reconnue</p>
            )}
          </div>
        </div>
      )}

      {/* Shared: légende + position (only if media is set) */}
      {hasMedia && (
        <>
          <div>
            <label className="mb-1.5 block text-xs text-white/40">Légende (optionnelle)</label>
            <input
              type="text"
              value={media!.legende ?? ""}
              onChange={(e) => onChange({ ...media!, legende: e.target.value })}
              placeholder="Source, description…"
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white placeholder-white/20 focus:border-teal-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs text-white/40">Disposition</label>
            <div className="flex gap-1.5">
              {(["dessus", "gauche", "droite", "fond"] as const)
                .filter((p) => media?.type === "youtube" ? p !== "fond" : true)
                .map((pos) => (
                  <button
                    key={pos}
                    type="button"
                    onClick={() => onChange({ ...media!, position: pos })}
                    className={`flex-1 rounded-md py-1.5 text-xs font-medium capitalize transition ${
                      media!.position === pos
                        ? "bg-teal-600 text-white"
                        : "border border-white/10 text-white/50 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    {pos}
                  </button>
                ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Slide renderer (presentation mode) ───────────────────────────────────────

function SlideContent({
  slide,
  style,
  onNext,
}: {
  slide: Slide;
  style: { label: string; bg: string; text: string; accent: string };
  onNext: () => void;
}) {
  const media = slide.media;
  const hasText = !!slide.titre || (slide.contenu ?? []).length > 0;

  const textBlock = (
    <div className="text-center">
      <h2 className={`text-3xl font-black leading-tight sm:text-4xl lg:text-5xl ${style.text}`}>
        {slide.titre}
      </h2>
      {(slide.contenu ?? []).length > 0 && (
        <ul className="mt-8 space-y-4">
          {(slide.contenu ?? []).map((ligne, i) => (
            <li key={i} className={`flex items-start gap-3 text-left text-lg leading-snug sm:text-xl ${style.text} opacity-90`}>
              <span className={`mt-1 flex-shrink-0 text-lg ${style.accent}`}>▸</span>
              <span>{ligne}</span>
            </li>
          ))}
        </ul>
      )}
      {slide.interaction && (
        <div className="mt-8 inline-flex items-center gap-2 rounded-full bg-white/10 px-5 py-2">
          <span className="text-sm font-semibold text-white/80">👥 {slide.interaction}</span>
        </div>
      )}
    </div>
  );

  const imageEl = media?.type === "image" ? (
    <div className="flex flex-col items-center gap-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={media.src}
        alt={media.legende ?? ""}
        className="max-h-64 max-w-full rounded-xl object-contain shadow-2xl"
        style={{ maxHeight: media.position === "dessus" ? "40vh" : "55vh" }}
      />
      {media.legende && (
        <p className="text-xs text-white/40 italic">{media.legende}</p>
      )}
    </div>
  ) : media?.type === "youtube" ? (
    <div className="flex flex-col items-center gap-2" onClick={(e) => e.stopPropagation()}>
      <div className="overflow-hidden rounded-xl shadow-2xl" style={{ width: "min(560px, 100%)", aspectRatio: "16/9" }}>
        <iframe
          src={`https://www.youtube.com/embed/${media.src}?rel=0`}
          className="h-full w-full"
          allowFullScreen
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        />
      </div>
      {media.legende && (
        <p className="text-xs text-white/40 italic">{media.legende}</p>
      )}
    </div>
  ) : null;

  // Layout based on position
  if (!media || !imageEl) {
    return (
      <div
        className="flex flex-1 cursor-pointer flex-col items-center justify-center px-8 py-10 sm:px-16"
        onClick={onNext}
      >
        <div className="w-full max-w-3xl">{textBlock}</div>
        <p className="absolute bottom-6 text-xs text-white/20">
          Clic ou → pour avancer · Esc pour fermer · N pour les notes
        </p>
      </div>
    );
  }

  if (media.position === "fond") {
    return (
      <div className="relative flex flex-1 cursor-pointer items-center justify-center px-8 py-10 sm:px-16" onClick={onNext}>
        <div className="absolute inset-0 overflow-hidden">
          {media.type === "image" && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={media.src} alt="" className="h-full w-full object-cover opacity-20" />
          )}
        </div>
        <div className="relative z-10 w-full max-w-3xl">{textBlock}</div>
        {media.legende && (
          <p className="absolute bottom-8 left-0 right-0 text-center text-xs text-white/30 italic">{media.legende}</p>
        )}
        <p className="absolute bottom-2 text-xs text-white/20">
          Clic ou → pour avancer · Esc pour fermer · N pour les notes
        </p>
      </div>
    );
  }

  if (media.position === "dessus") {
    return (
      <div className="flex flex-1 cursor-pointer flex-col items-center justify-center gap-6 px-8 py-8 sm:px-16" onClick={onNext}>
        {imageEl}
        {hasText && <div className="w-full max-w-3xl">{textBlock}</div>}
        <p className="absolute bottom-6 text-xs text-white/20">
          Clic ou → pour avancer · Esc pour fermer · N pour les notes
        </p>
      </div>
    );
  }

  // gauche / droite
  const leftEl = media.position === "gauche" ? imageEl : <div className="w-full max-w-xl">{textBlock}</div>;
  const rightEl = media.position === "gauche" ? <div className="w-full max-w-xl">{textBlock}</div> : imageEl;

  return (
    <div className="flex flex-1 cursor-pointer items-center gap-10 px-10 py-8 sm:px-16" onClick={onNext}>
      <div className="flex flex-1 justify-center">{leftEl}</div>
      <div className="flex flex-1 justify-center">{rightEl}</div>
      <p className="absolute bottom-6 text-xs text-white/20">
        Clic ou → pour avancer · Esc pour fermer · N pour les notes
      </p>
    </div>
  );
}

// ─── EditMode ─────────────────────────────────────────────────────────────────

function EditMode({
  cours,
  initialSlides,
  onSave,
  onCancel,
  onClose,
}: {
  cours: Props["cours"];
  initialSlides: Slide[];
  onSave: (slides: Slide[]) => void;
  onCancel: () => void;
  onClose: () => void;
}) {
  const [slides, setSlides] = useState<Slide[]>(initialSlides);
  const [selected, setSelected] = useState(0);
  const [hasChanges, setHasChanges] = useState(false);

  const slide = slides[selected];

  function update(patch: Partial<Slide>) {
    setSlides((prev) => {
      const next = [...prev];
      next[selected] = { ...next[selected], ...patch };
      return next;
    });
    setHasChanges(true);
  }

  function updateBullet(i: number, value: string) {
    const contenu = [...(slide.contenu ?? [])];
    contenu[i] = value;
    update({ contenu });
  }

  function addBullet() {
    update({ contenu: [...(slide.contenu ?? []), ""] });
  }

  function removeBullet(i: number) {
    update({ contenu: (slide.contenu ?? []).filter((_, idx) => idx !== i) });
  }

  function addSlideAfter(i: number) {
    setSlides((prev) => {
      const next = [...prev];
      next.splice(i + 1, 0, emptySlide());
      return next;
    });
    setSelected(i + 1);
    setHasChanges(true);
  }

  function removeSlide(i: number) {
    if (slides.length <= 1) return;
    setSlides((prev) => prev.filter((_, idx) => idx !== i));
    setSelected((s) => Math.min(s, slides.length - 2));
    setHasChanges(true);
  }

  function moveSlide(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= slides.length) return;
    setSlides((prev) => {
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
    setSelected(j);
    setHasChanges(true);
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950 text-white">
      {/* Header */}
      <div className="flex flex-shrink-0 items-center justify-between border-b border-white/10 bg-black/40 px-5 py-3">
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold uppercase tracking-widest text-amber-400">Mode édition</span>
          <span className="text-white/20">·</span>
          <span className="text-xs text-white/40 truncate max-w-xs">{cours.course.titre}</span>
        </div>
        <div className="flex items-center gap-2">
          {hasChanges && (
            <span className="hidden text-xs text-amber-400/70 italic sm:block">Modifications non sauvegardées</span>
          )}
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-white/20 px-3 py-1.5 text-xs font-semibold text-white/60 transition hover:bg-white/10 hover:text-white"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={() => onSave(slides)}
            disabled={!hasChanges}
            className="rounded-md bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-teal-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Sauvegarder
          </button>
          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-lg text-white/40 transition hover:bg-white/10 hover:text-white"
            aria-label="Fermer"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left — slide list */}
        <div className="flex w-56 flex-shrink-0 flex-col overflow-y-auto border-r border-white/10 bg-black/30 py-3">
          {slides.map((s, i) => {
            const st = getSlideStyle(s.type);
            return (
              <div
                key={i}
                onClick={() => setSelected(i)}
                className={`group relative mx-2 mb-1 cursor-pointer rounded-lg px-3 py-2 transition ${
                  i === selected ? "bg-white/15 ring-1 ring-white/20" : "hover:bg-white/5"
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className={`text-xs font-bold uppercase tracking-wide ${st.accent}`}>
                    {i + 1}. {getSlideStyle(s.type).label}
                  </span>
                  <div className="flex gap-0.5 opacity-0 transition group-hover:opacity-100">
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); moveSlide(i, -1); }}
                      disabled={i === 0}
                      title="Monter"
                      className="grid h-5 w-5 place-items-center rounded text-white/40 hover:text-white disabled:opacity-20"
                    >
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M18 15l-6-6-6 6"/></svg>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); moveSlide(i, 1); }}
                      disabled={i === slides.length - 1}
                      title="Descendre"
                      className="grid h-5 w-5 place-items-center rounded text-white/40 hover:text-white disabled:opacity-20"
                    >
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M6 9l6 6 6-6"/></svg>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); removeSlide(i); }}
                      disabled={slides.length <= 1}
                      title="Supprimer"
                      className="grid h-5 w-5 place-items-center rounded text-white/40 hover:text-red-400 disabled:opacity-20"
                    >
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M6 6l12 12M18 6L6 18"/></svg>
                    </button>
                  </div>
                </div>
                <p className="mt-0.5 truncate text-xs text-white/50">{s.titre}</p>
                {s.media && (
                  <span className="mt-1 inline-flex items-center gap-1 text-xs text-white/30">
                    {s.media.type === "youtube"
                      ? <><svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg> Vidéo</>
                      : <><svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg> Image</>
                    }
                  </span>
                )}
              </div>
            );
          })}

          <button
            type="button"
            onClick={() => addSlideAfter(slides.length - 1)}
            className="mx-2 mt-2 flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-white/20 py-2 text-xs text-white/40 transition hover:border-white/40 hover:text-white/70"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
            Ajouter une diapo
          </button>
        </div>

        {/* Right — edit form */}
        <div className="flex-1 overflow-y-auto px-8 py-6">
          <div className="mx-auto max-w-2xl space-y-5">

            {/* Type */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-white/40">Type</label>
              <select
                value={slide.type}
                onChange={(e) => update({ type: e.target.value })}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-teal-500 focus:outline-none"
              >
                {Object.entries(SLIDE_TYPE_LABELS).map(([value, { label }]) => (
                  <option key={value} value={value} className="bg-slate-900">{label}</option>
                ))}
                <option value="cours" className="bg-slate-900">Cours (autre)</option>
              </select>
            </div>

            {/* Titre */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-white/40">Titre</label>
              <input
                type="text"
                value={slide.titre ?? ""}
                onChange={(e) => update({ titre: e.target.value })}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/20 focus:border-teal-500 focus:outline-none"
                placeholder="Titre de la diapositive"
              />
            </div>

            {/* Contenu */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-white/40">Contenu</label>
              <div className="space-y-2">
                {(slide.contenu ?? []).map((ligne, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="flex-shrink-0 text-sm text-white/30">▸</span>
                    <input
                      type="text"
                      value={ligne}
                      onChange={(e) => updateBullet(i, e.target.value)}
                      className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/20 focus:border-teal-500 focus:outline-none"
                      placeholder={`Point ${i + 1}`}
                    />
                    <button
                      type="button"
                      onClick={() => removeBullet(i)}
                      className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-lg text-white/30 transition hover:bg-white/10 hover:text-red-400"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M6 6l12 12M18 6L6 18"/></svg>
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addBullet}
                  className="flex items-center gap-1.5 text-xs text-white/40 transition hover:text-white/70"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
                  Ajouter un point
                </button>
              </div>
            </div>

            {/* Média */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-white/40">Média</label>
              <MediaEditor
                media={slide.media}
                onChange={(m) => update({ media: m })}
              />
            </div>

            {/* Interaction */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-white/40">Interaction élèves</label>
              <input
                type="text"
                value={slide.interaction ?? ""}
                onChange={(e) => update({ interaction: e.target.value })}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/20 focus:border-teal-500 focus:outline-none"
                placeholder="Ex : Débat en groupe, exercice individuel…"
              />
            </div>

            {/* Notes enseignant */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-white/40">Notes enseignant</label>
              <textarea
                value={slide.notes_enseignant ?? ""}
                onChange={(e) => update({ notes_enseignant: e.target.value })}
                rows={4}
                className="w-full resize-none rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/20 focus:border-teal-500 focus:outline-none"
                placeholder="Notes visibles uniquement par l'enseignant…"
              />
            </div>

            {/* Per-slide actions */}
            <div className="flex gap-2 border-t border-white/10 pt-4">
              <button
                type="button"
                onClick={() => addSlideAfter(selected)}
                className="flex items-center gap-1.5 rounded-md border border-white/20 px-3 py-1.5 text-xs text-white/60 transition hover:bg-white/10 hover:text-white"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
                Insérer après cette diapo
              </button>
              <button
                type="button"
                onClick={() => removeSlide(selected)}
                disabled={slides.length <= 1}
                className="flex items-center gap-1.5 rounded-md border border-red-900/50 px-3 py-1.5 text-xs text-red-400/70 transition hover:bg-red-950 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-30"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>
                Supprimer cette diapo
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── CoursViewer (presentation mode) ─────────────────────────────────────────

export default function CoursViewer({ open, cours, onClose, onSave }: Props) {
  const [current, setCurrent] = useState(0);
  const [showNotes, setShowNotes] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [editMode, setEditMode] = useState(false);

  const totalSlides = cours.course.slides.length;

  const goNext = useCallback(() => setCurrent((c) => Math.min(c + 1, totalSlides - 1)), [totalSlides]);
  const goPrev = useCallback(() => setCurrent((c) => Math.max(c - 1, 0)), []);

  useEffect(() => {
    if (!open || editMode) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") { onClose(); return; }
      if (e.key === "ArrowRight" || e.key === "ArrowDown" || e.key === " ") { e.preventDefault(); goNext(); }
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); goPrev(); }
      if (e.key === "n" || e.key === "N") setShowNotes((v) => !v);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, editMode, goNext, goPrev, onClose]);

  useEffect(() => {
    if (open) { setCurrent(0); setShowNotes(false); setEditMode(false); }
  }, [open]);

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  }

  useEffect(() => {
    function onFsChange() { setIsFullscreen(!!document.fullscreenElement); }
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  if (!open) return null;

  if (editMode) {
    return (
      <EditMode
        cours={cours}
        initialSlides={JSON.parse(JSON.stringify(cours.course.slides))}
        onSave={(updatedSlides) => {
          onSave?.({ ...cours.course, slides: updatedSlides });
          setEditMode(false);
        }}
        onCancel={() => setEditMode(false)}
        onClose={onClose}
      />
    );
  }

  const slide = cours.course.slides[current];
  const style = getSlideStyle(slide.type);
  const progress = ((current + 1) / totalSlides) * 100;

  return (
    <div className={`fixed inset-0 z-50 flex flex-col ${style.bg} transition-colors duration-300`}>

      {/* Progress bar */}
      <div className="h-1 w-full bg-white/10">
        <div className="h-full bg-white/60 transition-all duration-500" style={{ width: `${progress}%` }} />
      </div>

      {/* Header bar */}
      <div className="flex items-center justify-between bg-black/30 px-5 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className={`text-xs font-bold uppercase tracking-widest ${style.accent}`}>
            {getSlideStyle(slide.type).label}
          </span>
          <span className="text-xs text-white/30">·</span>
          <span className="hidden truncate text-xs text-white/50 max-w-48 sm:block">
            {cours.course.titre}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {onSave && (
            <button
              type="button"
              onClick={() => setEditMode(true)}
              title="Modifier les diapositives"
              className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold text-white/40 transition hover:bg-white/10 hover:text-white/80"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4 12.5-12.5z"/>
              </svg>
              Éditer
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowNotes((v) => !v)}
            title="Notes enseignant (N)"
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition ${
              showNotes ? "bg-white/20 text-white" : "text-white/40 hover:text-white/70"
            }`}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4 12.5-12.5z"/>
            </svg>
            Notes
          </button>
          <button
            type="button"
            onClick={toggleFullscreen}
            title="Plein écran"
            className="text-white/40 transition hover:text-white/70"
          >
            {isFullscreen ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M8 3v3a2 2 0 01-2 2H3m18 0h-3a2 2 0 01-2-2V3m0 18v-3a2 2 0 012-2h3M3 16h3a2 2 0 012 2v3"/>
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M8 3H5a2 2 0 00-2 2v3m18 0V5a2 2 0 00-2-2h-3m0 18h3a2 2 0 002-2v-3M3 16v3a2 2 0 002 2h3"/>
              </svg>
            )}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-lg text-white/40 transition hover:bg-white/10 hover:text-white"
            aria-label="Fermer"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Main slide area */}
      <div className="flex flex-1 overflow-hidden">
        <SlideContent slide={slide} style={style} onNext={goNext} />

        {/* Notes panel */}
        {showNotes && (
          <div className="w-72 shrink-0 overflow-y-auto border-l border-white/10 bg-black/40 px-5 py-6 text-sm">
            <p className="mb-4 text-xs font-bold uppercase tracking-widest text-white/40">Notes enseignant</p>
            {slide.notes_enseignant ? (
              <p className="whitespace-pre-wrap leading-7 text-white/80">{slide.notes_enseignant}</p>
            ) : (
              <p className="italic text-white/30">Aucune note pour cette diapositive.</p>
            )}
          </div>
        )}
      </div>

      {/* Navigation footer */}
      <div className="flex items-center justify-between border-t border-white/10 bg-black/30 px-5 py-3">
        <div className="flex max-w-xs gap-1 overflow-x-auto sm:max-w-sm">
          {cours.course.slides.map((s, i) => (
            <button
              key={i}
              type="button"
              onClick={(e) => { e.stopPropagation(); setCurrent(i); }}
              title={`${i + 1}. ${s.titre}`}
              className={`h-2 w-6 flex-shrink-0 rounded-full transition-all ${
                i === current ? "scale-y-150 opacity-100" : "opacity-30 hover:opacity-60"
              } ${i <= current ? "bg-white" : "bg-white/30"}`}
            />
          ))}
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs text-white/40">{current + 1} / {totalSlides}</span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={goPrev}
              disabled={current === 0}
              className="grid h-9 w-9 place-items-center rounded-lg text-white/60 transition hover:bg-white/10 hover:text-white disabled:opacity-20"
              aria-label="Précédent"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 18l-6-6 6-6"/>
              </svg>
            </button>
            <button
              type="button"
              onClick={goNext}
              disabled={current === totalSlides - 1}
              className="grid h-9 w-9 place-items-center rounded-lg text-white/60 transition hover:bg-white/10 hover:text-white disabled:opacity-20"
              aria-label="Suivant"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 18l6-6-6-6"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
