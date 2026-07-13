"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  ChartBlock,
  CoursPresentation,
  MediaBlock,
  SchemaBlock,
  Slide,
  SlideBlock,
  SlideMedia
} from "../lib/course-types";
import { renderChartSvg, renderSchemaSvg } from "../lib/course-graphics";

// ─── Types ────────────────────────────────────────────────────────────────────

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
  onPrint?: () => void;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const SLIDE_TYPE_LABELS: Record<string, { label: string; bg: string; text: string; accent: string }> = {
  accroche:              { label: "Accroche",              bg: "bg-[#032026]", text: "text-white", accent: "text-[#ffc145]" },
  recherche:             { label: "Recherche",             bg: "bg-[#032026]", text: "text-white", accent: "text-[#ffb000]" },
  mise_en_commun:        { label: "Mise en commun",        bg: "bg-[#032026]", text: "text-white", accent: "text-[#7fb8b0]" },
  institutionnalisation: { label: "Institutionnalisation", bg: "bg-[#032026]", text: "text-white", accent: "text-[#006b60]" },
  entrainement:          { label: "Entraînement",          bg: "bg-[#032026]", text: "text-white", accent: "text-[#ff8500]" },
  synthese:              { label: "Synthèse",              bg: "bg-[#032026]", text: "text-white", accent: "text-[#ffc145]" },
};

const DEFAULT_STYLE = { label: "Cours", bg: "bg-[#032026]", text: "text-white", accent: "text-white/70" };

function getSlideStyle(type: string) {
  return SLIDE_TYPE_LABELS[type] ?? DEFAULT_STYLE;
}

function emptySlide(): Slide {
  return {
    id: crypto.randomUUID(),
    titre: "Nouvelle diapositive",
    type: "cours",
    blocks: [],
    notes_enseignant: "",
    interaction: ""
  };
}

function newBlock(type: SlideBlock["type"]): SlideBlock {
  if (type === "text") {
    return { id: crypto.randomUUID(), type: "text", style: "bullets", lignes: [""] };
  }
  if (type === "chart") {
    return {
      id: crypto.randomUUID(),
      type: "chart",
      chartType: "bar",
      titre: "",
      categories: ["", ""],
      series: [{ nom: "", valeurs: [0, 0] }]
    };
  }
  if (type === "schema") {
    return {
      id: crypto.randomUUID(),
      type: "schema",
      variant: "etapes",
      titre: "",
      etapes: [{ label: "" }, { label: "" }]
    };
  }
  return { id: crypto.randomUUID(), type: "media", media: { type: "image", src: "", disposition: "dessus" } };
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
      disposition: media?.disposition ?? "dessus",
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
        disposition: media?.disposition ?? "dessus",
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
      disposition: media?.disposition ?? "dessus",
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

          <div>
            <label className="mb-1.5 block text-xs text-white/40">URL d'une image</label>
            <div className="flex gap-2">
              <input
                type="url"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && applyImageUrl()}
                placeholder="https://…"
                className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white placeholder-white/20 focus:border-teal-600 focus:outline-none"
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
                className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white placeholder-white/20 focus:border-teal-600 focus:outline-none"
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

      {/* Shared: légende + disposition (only if media is set) */}
      {hasMedia && (
        <>
          <div>
            <label className="mb-1.5 block text-xs text-white/40">Légende (optionnelle)</label>
            <input
              type="text"
              value={media!.legende ?? ""}
              onChange={(e) => onChange({ ...media!, legende: e.target.value })}
              placeholder="Source, description…"
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white placeholder-white/20 focus:border-teal-600 focus:outline-none"
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
                    onClick={() => onChange({ ...media!, disposition: pos })}
                    className={`flex-1 rounded-md py-1.5 text-xs font-medium capitalize transition ${
                      media!.disposition === pos
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

// ─── Small block-editing primitives (used inside EditMode) ───────────────────

function BulletListEditor({
  items,
  onChange,
  placeholder = "Point"
}: {
  items: string[];
  onChange: (items: string[]) => void;
  placeholder?: string;
}) {
  function updateItem(i: number, value: string) {
    const next = [...items];
    next[i] = value;
    onChange(next);
  }
  function addItem() {
    onChange([...items, ""]);
  }
  function removeItem(i: number) {
    onChange(items.filter((_, idx) => idx !== i));
  }
  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="flex-shrink-0 text-sm text-white/30">▸</span>
          <input
            type="text"
            value={item}
            onChange={(e) => updateItem(i, e.target.value)}
            className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/20 focus:border-teal-600 focus:outline-none"
            placeholder={`${placeholder} ${i + 1}`}
          />
          <button
            type="button"
            onClick={() => removeItem(i)}
            className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-lg text-white/30 transition hover:bg-white/10 hover:text-red-400"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M6 6l12 12M18 6L6 18"/></svg>
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={addItem}
        className="flex items-center gap-1.5 text-xs text-white/40 transition hover:text-white/70"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
        Ajouter un point
      </button>
    </div>
  );
}

function StepListEditor({
  steps,
  onChange,
  withDate = false,
  min = 2,
  max = 8
}: {
  steps: { date?: string; label: string; description?: string }[];
  onChange: (steps: { date?: string; label: string; description?: string }[]) => void;
  withDate?: boolean;
  min?: number;
  max?: number;
}) {
  function update(i: number, patch: Partial<{ date: string; label: string; description: string }>) {
    const next = [...steps];
    next[i] = { ...next[i], ...patch };
    onChange(next);
  }
  function add() {
    if (steps.length >= max) return;
    onChange([...steps, withDate ? { date: "", label: "" } : { label: "" }]);
  }
  function remove(i: number) {
    if (steps.length <= min) return;
    onChange(steps.filter((_, idx) => idx !== i));
  }
  return (
    <div className="space-y-2">
      {steps.map((step, i) => (
        <div key={i} className="space-y-1.5 rounded-lg border border-white/10 bg-white/5 p-2.5">
          <div className="flex items-center gap-2">
            <span className="flex-shrink-0 text-xs font-bold text-white/30">{i + 1}</span>
            {withDate && (
              <input
                type="text"
                value={step.date ?? ""}
                onChange={(e) => update(i, { date: e.target.value })}
                placeholder="Date"
                className="w-24 flex-shrink-0 rounded-md border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-white placeholder-white/20 focus:border-teal-600 focus:outline-none"
              />
            )}
            <input
              type="text"
              value={step.label}
              onChange={(e) => update(i, { label: e.target.value })}
              placeholder="Libellé"
              className="flex-1 rounded-md border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-white placeholder-white/20 focus:border-teal-600 focus:outline-none"
            />
            <button
              type="button"
              onClick={() => remove(i)}
              disabled={steps.length <= min}
              className="grid h-7 w-7 flex-shrink-0 place-items-center rounded text-white/30 transition hover:bg-white/10 hover:text-red-400 disabled:opacity-20"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M6 6l12 12M18 6L6 18"/></svg>
            </button>
          </div>
          <input
            type="text"
            value={step.description ?? ""}
            onChange={(e) => update(i, { description: e.target.value })}
            placeholder="Description (optionnelle)"
            className="w-full rounded-md border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-white placeholder-white/20 focus:border-teal-600 focus:outline-none"
          />
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        disabled={steps.length >= max}
        className="flex items-center gap-1.5 text-xs text-white/40 transition hover:text-white/70 disabled:opacity-30"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
        Ajouter une étape
      </button>
    </div>
  );
}

function PointListEditor({
  points,
  onChange
}: {
  points: { numero: number; x: number; y: number; label: string }[];
  onChange: (points: { numero: number; x: number; y: number; label: string }[]) => void;
}) {
  function update(i: number, patch: Partial<{ x: number; y: number; label: string }>) {
    const next = [...points];
    next[i] = { ...next[i], ...patch };
    onChange(next);
  }
  function add() {
    onChange([...points, { numero: points.length + 1, x: 50, y: 50, label: "" }]);
  }
  function remove(i: number) {
    onChange(points.filter((_, idx) => idx !== i).map((p, idx) => ({ ...p, numero: idx + 1 })));
  }
  return (
    <div className="space-y-2">
      {points.map((point, i) => (
        <div key={i} className="space-y-1.5 rounded-lg border border-white/10 bg-white/5 p-2.5">
          <div className="flex items-center gap-2">
            <span className="grid h-6 w-6 flex-shrink-0 place-items-center rounded-full bg-[#ffc145] text-xs font-bold text-[#032026]">
              {point.numero}
            </span>
            <input
              type="text"
              value={point.label}
              onChange={(e) => update(i, { label: e.target.value })}
              placeholder="Libellé du point"
              className="flex-1 rounded-md border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-white placeholder-white/20 focus:border-teal-600 focus:outline-none"
            />
            <button
              type="button"
              onClick={() => remove(i)}
              className="grid h-7 w-7 flex-shrink-0 place-items-center rounded text-white/30 transition hover:bg-white/10 hover:text-red-400"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M6 6l12 12M18 6L6 18"/></svg>
            </button>
          </div>
          <div className="flex items-center gap-3 text-xs text-white/40">
            <label className="flex flex-1 items-center gap-2">
              X
              <input type="range" min={0} max={100} value={point.x} onChange={(e) => update(i, { x: Number(e.target.value) })} className="flex-1" />
            </label>
            <label className="flex flex-1 items-center gap-2">
              Y
              <input type="range" min={0} max={100} value={point.y} onChange={(e) => update(i, { y: Number(e.target.value) })} className="flex-1" />
            </label>
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        className="flex items-center gap-1.5 text-xs text-white/40 transition hover:text-white/70"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
        Ajouter un point
      </button>
    </div>
  );
}

function ComparaisonEditor({
  colonnes,
  onChange
}: {
  colonnes: { titre: string; points: string[] }[];
  onChange: (colonnes: { titre: string; points: string[] }[]) => void;
}) {
  function updateTitre(i: number, titre: string) {
    const next = [...colonnes];
    next[i] = { ...next[i], titre };
    onChange(next);
  }
  function updatePoints(i: number, points: string[]) {
    const next = [...colonnes];
    next[i] = { ...next[i], points };
    onChange(next);
  }
  function add() {
    if (colonnes.length >= 3) return;
    onChange([...colonnes, { titre: "", points: [""] }]);
  }
  function remove(i: number) {
    if (colonnes.length <= 2) return;
    onChange(colonnes.filter((_, idx) => idx !== i));
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {colonnes.map((col, i) => (
        <div key={i} className="space-y-2 rounded-lg border border-white/10 bg-white/5 p-3">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={col.titre}
              onChange={(e) => updateTitre(i, e.target.value)}
              placeholder={`Titre colonne ${i + 1}`}
              className="flex-1 rounded-md border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs font-semibold text-white placeholder-white/20 focus:border-teal-600 focus:outline-none"
            />
            {colonnes.length > 2 && (
              <button type="button" onClick={() => remove(i)} className="text-white/30 hover:text-red-400">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M6 6l12 12M18 6L6 18"/></svg>
              </button>
            )}
          </div>
          <BulletListEditor items={col.points} onChange={(points) => updatePoints(i, points)} />
        </div>
      ))}
      {colonnes.length < 3 && (
        <button
          type="button"
          onClick={add}
          className="flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-white/20 py-3 text-xs text-white/40 transition hover:border-white/40 hover:text-white/70"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
          Ajouter une colonne
        </button>
      )}
    </div>
  );
}

function ChartBlockEditor({
  block,
  onChange
}: {
  block: ChartBlock;
  onChange: (block: ChartBlock) => void;
}) {
  function updateCategory(i: number, value: string) {
    const categories = [...block.categories];
    categories[i] = value;
    onChange({ ...block, categories });
  }
  function addCategory() {
    if (block.categories.length >= 8) return;
    onChange({
      ...block,
      categories: [...block.categories, ""],
      series: block.series.map((s) => ({ ...s, valeurs: [...s.valeurs, 0] }))
    });
  }
  function removeCategory(i: number) {
    if (block.categories.length <= 2) return;
    onChange({
      ...block,
      categories: block.categories.filter((_, idx) => idx !== i),
      series: block.series.map((s) => ({ ...s, valeurs: s.valeurs.filter((_, idx) => idx !== i) }))
    });
  }
  function updateSerieNom(si: number, nom: string) {
    const series = [...block.series];
    series[si] = { ...series[si], nom };
    onChange({ ...block, series });
  }
  function updateValeur(si: number, ci: number, value: number) {
    const series = [...block.series];
    const valeurs = [...series[si].valeurs];
    valeurs[ci] = value;
    series[si] = { ...series[si], valeurs };
    onChange({ ...block, series });
  }
  function addSerie() {
    if (block.series.length >= 4) return;
    onChange({ ...block, series: [...block.series, { nom: "", valeurs: block.categories.map(() => 0) }] });
  }
  function removeSerie(si: number) {
    if (block.series.length <= 1) return;
    onChange({ ...block, series: block.series.filter((_, idx) => idx !== si) });
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-1.5">
        {(["bar", "line", "pie"] as const).map((ct) => (
          <button
            key={ct}
            type="button"
            onClick={() => onChange({ ...block, chartType: ct, series: ct === "pie" ? [block.series[0]] : block.series })}
            className={`flex-1 rounded-md py-1.5 text-xs font-semibold transition ${
              block.chartType === ct ? "bg-teal-600 text-white" : "border border-white/10 text-white/50 hover:bg-white/10 hover:text-white"
            }`}
          >
            {ct === "bar" ? "Barres" : ct === "line" ? "Courbes" : "Camembert"}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={block.titre ?? ""}
          onChange={(e) => onChange({ ...block, titre: e.target.value })}
          placeholder="Titre du graphique"
          className="flex-1 rounded-md border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-white placeholder-white/20 focus:border-teal-600 focus:outline-none"
        />
        <input
          type="text"
          value={block.unite ?? ""}
          onChange={(e) => onChange({ ...block, unite: e.target.value })}
          placeholder="Unité"
          className="w-24 rounded-md border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-white placeholder-white/20 focus:border-teal-600 focus:outline-none"
        />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr>
              <th className="pb-1 text-left text-white/40">Catégorie</th>
              {block.series.map((s, si) => (
                <th key={si} className="pb-1 pl-2">
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      value={s.nom}
                      onChange={(e) => updateSerieNom(si, e.target.value)}
                      placeholder={`Série ${si + 1}`}
                      className="w-20 rounded border border-white/10 bg-white/5 px-1.5 py-1 text-white placeholder-white/20 focus:border-teal-600 focus:outline-none"
                    />
                    {block.chartType !== "pie" && block.series.length > 1 && (
                      <button type="button" onClick={() => removeSerie(si)} className="text-white/30 hover:text-red-400">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M6 6l12 12M18 6L6 18"/></svg>
                      </button>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {block.categories.map((cat, ci) => (
              <tr key={ci}>
                <td className="py-1 pr-2">
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      value={cat}
                      onChange={(e) => updateCategory(ci, e.target.value)}
                      placeholder={`Catégorie ${ci + 1}`}
                      className="w-24 rounded border border-white/10 bg-white/5 px-1.5 py-1 text-white placeholder-white/20 focus:border-teal-600 focus:outline-none"
                    />
                    {block.categories.length > 2 && (
                      <button type="button" onClick={() => removeCategory(ci)} className="text-white/30 hover:text-red-400">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M6 6l12 12M18 6L6 18"/></svg>
                      </button>
                    )}
                  </div>
                </td>
                {block.series.map((s, si) => (
                  <td key={si} className="py-1 pl-2">
                    <input
                      type="number"
                      value={s.valeurs[ci]}
                      onChange={(e) => updateValeur(si, ci, Number(e.target.value))}
                      className="w-16 rounded border border-white/10 bg-white/5 px-1.5 py-1 text-white focus:border-teal-600 focus:outline-none"
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex gap-3">
        <button type="button" onClick={addCategory} disabled={block.categories.length >= 8} className="flex items-center gap-1.5 text-xs text-white/40 transition hover:text-white/70 disabled:opacity-30">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
          Catégorie
        </button>
        {block.chartType !== "pie" && (
          <button type="button" onClick={addSerie} disabled={block.series.length >= 4} className="flex items-center gap-1.5 text-xs text-white/40 transition hover:text-white/70 disabled:opacity-30">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
            Série
          </button>
        )}
      </div>
    </div>
  );
}

function SchemaBlockEditor({
  block,
  onChange
}: {
  block: SchemaBlock;
  onChange: (block: SchemaBlock) => void;
}) {
  const variants: { value: SchemaBlock["variant"]; label: string }[] = [
    { value: "frise", label: "Frise" },
    { value: "cycle", label: "Cycle" },
    { value: "etapes", label: "Étapes" },
    { value: "legende", label: "Figure légendée" },
    { value: "comparaison", label: "Comparaison" }
  ];

  function switchVariant(variant: SchemaBlock["variant"]) {
    const titre = block.titre;
    if (variant === "frise") {
      onChange({ id: block.id, type: "schema", variant, titre, evenements: [{ date: "", label: "" }, { date: "", label: "" }] });
    } else if (variant === "cycle") {
      onChange({ id: block.id, type: "schema", variant, titre, etapes: [{ label: "" }, { label: "" }, { label: "" }] });
    } else if (variant === "etapes") {
      onChange({ id: block.id, type: "schema", variant, titre, etapes: [{ label: "" }, { label: "" }] });
    } else if (variant === "legende") {
      onChange({ id: block.id, type: "schema", variant, titre, points: [] });
    } else {
      onChange({ id: block.id, type: "schema", variant, titre, colonnes: [{ titre: "", points: [""] }, { titre: "", points: [""] }] });
    }
  }

  const variantSelect = (
    <select
      value={block.variant}
      onChange={(e) => switchVariant(e.target.value as SchemaBlock["variant"])}
      className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white focus:border-teal-600 focus:outline-none"
    >
      {variants.map((v) => (
        <option key={v.value} value={v.value} className="bg-slate-900">{v.label}</option>
      ))}
    </select>
  );

  const titreInput = (
    <input
      type="text"
      value={block.titre ?? ""}
      onChange={(e) => onChange({ ...block, titre: e.target.value } as SchemaBlock)}
      placeholder="Titre du schéma (optionnel)"
      className="w-full rounded-md border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-white placeholder-white/20 focus:border-teal-600 focus:outline-none"
    />
  );

  if (block.variant === "frise") {
    return (
      <div className="space-y-3">
        {variantSelect}
        {titreInput}
        <StepListEditor
          withDate
          min={2}
          max={8}
          steps={block.evenements}
          onChange={(evenements) =>
            onChange({
              ...block,
              evenements: evenements.map((s) => ({ date: s.date ?? "", label: s.label, description: s.description }))
            })
          }
        />
      </div>
    );
  }

  if (block.variant === "cycle" || block.variant === "etapes") {
    return (
      <div className="space-y-3">
        {variantSelect}
        {titreInput}
        <StepListEditor
          min={block.variant === "cycle" ? 3 : 2}
          max={8}
          steps={block.etapes}
          onChange={(etapes) =>
            onChange({ ...block, etapes: etapes.map((s) => ({ label: s.label, description: s.description })) })
          }
        />
      </div>
    );
  }

  if (block.variant === "legende") {
    return (
      <div className="space-y-3">
        {variantSelect}
        {titreInput}
        <MediaEditor
          media={block.image?.src ? { type: "image", src: block.image.src, disposition: "dessus" } : undefined}
          onChange={(m) => onChange({ ...block, image: m ? { src: m.src } : undefined })}
        />
        <PointListEditor points={block.points} onChange={(points) => onChange({ ...block, points })} />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {variantSelect}
      {titreInput}
      <ComparaisonEditor colonnes={block.colonnes} onChange={(colonnes) => onChange({ ...block, colonnes })} />
    </div>
  );
}

function BlockCard({
  block,
  index,
  total,
  onChange,
  onMove,
  onRemove
}: {
  block: SlideBlock;
  index: number;
  total: number;
  onChange: (block: SlideBlock) => void;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
}) {
  const kindLabel =
    block.type === "text" ? "Texte" : block.type === "chart" ? "Graphique" : block.type === "schema" ? "Schéma" : "Média";

  return (
    <div className="space-y-3 rounded-lg border border-white/10 bg-white/5 p-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wide text-white/40">{kindLabel}</span>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => onMove(-1)} disabled={index === 0} className="grid h-6 w-6 place-items-center rounded text-white/30 hover:text-white disabled:opacity-20">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M18 15l-6-6-6 6"/></svg>
          </button>
          <button type="button" onClick={() => onMove(1)} disabled={index === total - 1} className="grid h-6 w-6 place-items-center rounded text-white/30 hover:text-white disabled:opacity-20">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M6 9l6 6 6-6"/></svg>
          </button>
          <button type="button" onClick={onRemove} className="grid h-6 w-6 place-items-center rounded text-white/30 hover:text-red-400">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M6 6l12 12M18 6L6 18"/></svg>
          </button>
        </div>
      </div>

      {block.type === "text" && (
        <div className="space-y-2">
          <div className="flex gap-1.5">
            {(["bullets", "paragraph"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => onChange({ ...block, style: s })}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                  (block.style ?? "bullets") === s ? "bg-teal-600 text-white" : "border border-white/10 text-white/50 hover:bg-white/10 hover:text-white"
                }`}
              >
                {s === "bullets" ? "Puces" : "Paragraphe"}
              </button>
            ))}
          </div>
          <BulletListEditor items={block.lignes} onChange={(lignes) => onChange({ ...block, lignes })} />
        </div>
      )}
      {block.type === "chart" && <ChartBlockEditor block={block} onChange={onChange} />}
      {block.type === "schema" && <SchemaBlockEditor block={block} onChange={onChange} />}
      {block.type === "media" && (
        <MediaEditor
          media={block.media.src ? block.media : undefined}
          onChange={(m) => (m ? onChange({ ...block, media: m }) : onRemove())}
        />
      )}
    </div>
  );
}

function AddBlockMenu({ onAdd }: { onAdd: (type: SlideBlock["type"]) => void }) {
  const [open, setOpen] = useState(false);
  const options: { type: SlideBlock["type"]; label: string }[] = [
    { type: "text", label: "Texte" },
    { type: "chart", label: "Graphique" },
    { type: "schema", label: "Schéma" },
    { type: "media", label: "Média" }
  ];
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-white/20 py-2.5 text-xs text-white/40 transition hover:border-white/40 hover:text-white/70"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
        Ajouter un bloc
      </button>
      {open && (
        <div className="absolute left-0 right-0 top-full z-10 mt-1 overflow-hidden rounded-lg border border-white/10 bg-slate-900 shadow-2xl">
          {options.map((opt) => (
            <button
              key={opt.type}
              type="button"
              onClick={() => {
                onAdd(opt.type);
                setOpen(false);
              }}
              className="block w-full px-4 py-2 text-left text-xs text-white/70 transition hover:bg-white/10 hover:text-white"
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Slide renderer (presentation mode) ───────────────────────────────────────

function BlockRenderer({ block, style }: { block: SlideBlock; style: { text: string; accent: string } }) {
  if (block.type === "text") {
    if (block.style === "paragraph") {
      return (
        <div className={`space-y-3 text-left text-lg leading-snug sm:text-xl ${style.text} opacity-90`}>
          {block.lignes.map((ligne, i) => (
            <p key={i}>{ligne}</p>
          ))}
        </div>
      );
    }
    return (
      <ul className="space-y-4">
        {block.lignes.map((ligne, i) => (
          <li key={i} className={`flex items-start gap-3 text-left text-lg leading-snug sm:text-xl ${style.text} opacity-90`}>
            <span className={`mt-1 flex-shrink-0 text-lg ${style.accent}`}>▸</span>
            <span>{ligne}</span>
          </li>
        ))}
      </ul>
    );
  }
  if (block.type === "chart") {
    return (
      <div
        className="w-full"
        dangerouslySetInnerHTML={{ __html: renderChartSvg(block, { palette: "screen", width: 480, height: 280 }) }}
      />
    );
  }
  if (block.type === "schema") {
    return (
      <div
        className="w-full"
        dangerouslySetInnerHTML={{ __html: renderSchemaSvg(block, { palette: "screen", width: 560, height: 300 }) }}
      />
    );
  }
  return null;
}

function renderMediaEl(media: SlideMedia) {
  if (media.type === "image") {
    return (
      <div className="flex flex-col items-center gap-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={media.src}
          alt={media.legende ?? ""}
          className="max-h-64 max-w-full rounded-xl object-contain shadow-2xl"
          style={{ maxHeight: media.disposition === "dessus" ? "40vh" : "55vh" }}
        />
        {media.legende && <p className="text-xs text-white/40 italic">{media.legende}</p>}
      </div>
    );
  }
  if (media.type === "youtube") {
    return (
      <div className="flex flex-col items-center gap-2" onClick={(e) => e.stopPropagation()}>
        <div className="overflow-hidden rounded-xl shadow-2xl" style={{ width: "min(560px, 100%)", aspectRatio: "16/9" }}>
          <iframe
            src={`https://www.youtube.com/embed/${media.src}?rel=0`}
            className="h-full w-full"
            allowFullScreen
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          />
        </div>
        {media.legende && <p className="text-xs text-white/40 italic">{media.legende}</p>}
      </div>
    );
  }
  return null;
}

function SlideContent({
  slide,
  style,
  onNext,
}: {
  slide: Slide;
  style: { label: string; bg: string; text: string; accent: string };
  onNext: () => void;
}) {
  const mediaBlock = slide.blocks.find(
    (b): b is MediaBlock => b.type === "media" && !!b.media.src
  );
  const otherBlocks = slide.blocks.filter((b) => b !== mediaBlock);
  const hasOther = otherBlocks.length > 0;

  const contentStack = (
    <div className="space-y-6">
      {otherBlocks.map((b) => (
        <BlockRenderer key={b.id} block={b} style={style} />
      ))}
      {slide.interaction && (
        <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-5 py-2">
          <span className="text-sm font-semibold text-white/80">👥 {slide.interaction}</span>
        </div>
      )}
    </div>
  );

  const titleEl = slide.titre ? (
    <h2 className={`text-3xl font-black leading-tight sm:text-4xl lg:text-5xl ${style.text}`}>{slide.titre}</h2>
  ) : null;

  const fullStack = (
    <div className="w-full max-w-3xl space-y-6 text-center">
      {titleEl}
      {contentStack}
    </div>
  );

  const imageEl = mediaBlock ? renderMediaEl(mediaBlock.media) : null;

  if (!mediaBlock || !imageEl) {
    return (
      <div className="flex flex-1 cursor-pointer flex-col items-center justify-center px-8 py-10 sm:px-16" onClick={onNext}>
        {fullStack}
        <p className="absolute bottom-6 text-xs text-white/20">
          Clic ou → pour avancer · Esc pour fermer · N pour les notes
        </p>
      </div>
    );
  }

  if (mediaBlock.media.disposition === "fond") {
    return (
      <div className="relative flex flex-1 cursor-pointer items-center justify-center px-8 py-10 sm:px-16" onClick={onNext}>
        <div className="absolute inset-0 overflow-hidden">
          {mediaBlock.media.type === "image" && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={mediaBlock.media.src} alt="" className="h-full w-full object-cover opacity-20" />
          )}
        </div>
        <div className="relative z-10">{fullStack}</div>
        {mediaBlock.media.legende && (
          <p className="absolute bottom-8 left-0 right-0 text-center text-xs text-white/30 italic">{mediaBlock.media.legende}</p>
        )}
        <p className="absolute bottom-2 text-xs text-white/20">
          Clic ou → pour avancer · Esc pour fermer · N pour les notes
        </p>
      </div>
    );
  }

  if (mediaBlock.media.disposition === "dessus") {
    return (
      <div className="flex flex-1 cursor-pointer flex-col items-center justify-center gap-6 px-8 py-8 sm:px-16" onClick={onNext}>
        {imageEl}
        {(slide.titre || hasOther) && fullStack}
        <p className="absolute bottom-6 text-xs text-white/20">
          Clic ou → pour avancer · Esc pour fermer · N pour les notes
        </p>
      </div>
    );
  }

  const leftEl = mediaBlock.media.disposition === "gauche" ? imageEl : <div className="w-full max-w-xl">{fullStack}</div>;
  const rightEl = mediaBlock.media.disposition === "gauche" ? <div className="w-full max-w-xl">{fullStack}</div> : imageEl;

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

  function addBlock(type: SlideBlock["type"]) {
    update({ blocks: [...slide.blocks, newBlock(type)] });
  }

  function updateBlock(blockId: string, patch: SlideBlock) {
    update({ blocks: slide.blocks.map((b) => (b.id === blockId ? patch : b)) });
  }

  function moveBlock(index: number, dir: -1 | 1) {
    const j = index + dir;
    if (j < 0 || j >= slide.blocks.length) return;
    const blocks = [...slide.blocks];
    [blocks[index], blocks[j]] = [blocks[j], blocks[index]];
    update({ blocks });
  }

  function removeBlock(blockId: string) {
    update({ blocks: slide.blocks.filter((b) => b.id !== blockId) });
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
            const hasMedia = s.blocks.some((b) => b.type === "media");
            return (
              <div
                key={s.id}
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
                {hasMedia && (
                  <span className="mt-1 inline-flex items-center gap-1 text-xs text-white/30">
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg> Média
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
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-teal-600 focus:outline-none"
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
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/20 focus:border-teal-600 focus:outline-none"
                placeholder="Titre de la diapositive"
              />
            </div>

            {/* Blocs */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-white/40">Contenu</label>
              <div className="space-y-3">
                {slide.blocks.map((block, i) => (
                  <BlockCard
                    key={block.id}
                    block={block}
                    index={i}
                    total={slide.blocks.length}
                    onChange={(patch) => updateBlock(block.id, patch)}
                    onMove={(dir) => moveBlock(i, dir)}
                    onRemove={() => removeBlock(block.id)}
                  />
                ))}
                <AddBlockMenu onAdd={addBlock} />
              </div>
            </div>

            {/* Interaction */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-white/40">Interaction élèves</label>
              <input
                type="text"
                value={slide.interaction ?? ""}
                onChange={(e) => update({ interaction: e.target.value })}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/20 focus:border-teal-600 focus:outline-none"
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
                className="w-full resize-none rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/20 focus:border-teal-600 focus:outline-none"
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

export default function CoursViewer({ open, cours, onClose, onSave, onPrint }: Props) {
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
          {onPrint && (
            <button
              type="button"
              onClick={onPrint}
              title="Imprimer / exporter"
              className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold text-white/40 transition hover:bg-white/10 hover:text-white/80"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>
              </svg>
              Imprimer
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
              key={s.id}
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
