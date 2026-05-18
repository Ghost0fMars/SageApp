"use client";

import { useEffect, useState } from "react";
import { readAiConfig, writeAiConfig, type AiProvider } from "../lib/ai-config";

type ProviderOption = {
  id: AiProvider;
  name: string;
  subtitle: string;
  apiKeyLabel: string;
  apiKeyPlaceholder: string;
  apiKeyLink: string;
  apiKeyLinkLabel: string;
};

const PROVIDERS: ProviderOption[] = [
  {
    id: "openai",
    name: "ChatGPT",
    subtitle: "OpenAI",
    apiKeyLabel: "Clé API OpenAI",
    apiKeyPlaceholder: "sk-proj-...",
    apiKeyLink: "https://platform.openai.com/api-keys",
    apiKeyLinkLabel: "Obtenir une clé OpenAI"
  },
  {
    id: "claude",
    name: "Claude",
    subtitle: "Anthropic",
    apiKeyLabel: "Clé API Anthropic",
    apiKeyPlaceholder: "sk-ant-...",
    apiKeyLink: "https://console.anthropic.com/settings/keys",
    apiKeyLinkLabel: "Obtenir une clé Anthropic"
  },
  {
    id: "gemini",
    name: "Gemini",
    subtitle: "Google",
    apiKeyLabel: "Clé API Google AI Studio",
    apiKeyPlaceholder: "AIza...",
    apiKeyLink: "https://aistudio.google.com/app/apikey",
    apiKeyLinkLabel: "Obtenir une clé Gemini"
  },
  {
    id: "mistral",
    name: "Le Chat",
    subtitle: "Mistral AI",
    apiKeyLabel: "Clé API Mistral",
    apiKeyPlaceholder: "...",
    apiKeyLink: "https://console.mistral.ai/api-keys",
    apiKeyLinkLabel: "Obtenir une clé Mistral"
  }
];

type Props = {
  open: boolean;
  onClose: () => void;
  freeLimitReached?: boolean;
};

export function AiConfigForm({ onSaved }: { onSaved?: () => void }) {
  const [selectedProvider, setSelectedProvider] = useState<AiProvider>("openai");
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const config = readAiConfig();
    if (config) {
      setSelectedProvider(config.provider);
      setApiKey(config.apiKey);
    }
  }, []);

  const activeProviderOption = PROVIDERS.find((p) => p.id === selectedProvider);

  function handleSave() {
    writeAiConfig({ provider: selectedProvider, apiKey });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    onSaved?.();
  }

  const canSave = selectedProvider === "none" || apiKey.trim().length > 0;

  return (
    <div className="grid gap-5">
      <div className="grid grid-cols-2 gap-2">
        {PROVIDERS.map((provider) => {
          const isSelected = selectedProvider === provider.id;
          return (
            <button
              key={provider.id}
              type="button"
              onClick={() => setSelectedProvider(provider.id)}
              className={`rounded-xl border-2 px-4 py-3 text-left transition ${
                isSelected
                  ? "border-teal-500 bg-teal-50 text-teal-900"
                  : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
              }`}
            >
              <p className="text-sm font-semibold">{provider.name}</p>
              <p className="mt-0.5 text-xs text-slate-500">{provider.subtitle}</p>
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => setSelectedProvider("none")}
          className={`col-span-2 rounded-xl border-2 px-4 py-3 text-left transition ${
            selectedProvider === "none"
              ? "border-slate-400 bg-slate-100 text-slate-900"
              : "border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50"
          }`}
        >
          <p className="text-sm font-semibold">Sans IA</p>
          <p className="mt-0.5 text-xs text-slate-500">
            Désactiver les fonctionnalités d&apos;intelligence artificielle
          </p>
        </button>
      </div>

      {selectedProvider !== "none" && activeProviderOption && (
        <div className="grid gap-2">
          <label className="text-sm font-semibold text-slate-800">
            {activeProviderOption.apiKeyLabel}
          </label>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <input
                type={showKey ? "text" : "password"}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={activeProviderOption.apiKeyPlaceholder}
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 pr-10 text-sm text-slate-800 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                autoComplete="off"
                spellCheck={false}
              />
              <button
                type="button"
                onClick={() => setShowKey((v) => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-600"
                title={showKey ? "Masquer" : "Afficher"}
              >
                {showKey ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
          </div>
          <a
            href={activeProviderOption.apiKeyLink}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-teal-600 underline-offset-2 hover:underline"
          >
            {activeProviderOption.apiKeyLinkLabel} ↗
          </a>
        </div>
      )}

      <p className="rounded-lg bg-slate-50 px-3 py-2.5 text-xs leading-5 text-slate-600">
        Votre clé API est sauvegardée dans votre compte et synchronisée entre vos appareils. Elle
        n&apos;est utilisée que pour être transmise au fournisseur IA lors de chaque génération.
      </p>

      <button
        type="button"
        onClick={handleSave}
        disabled={!canSave}
        className="w-full rounded-lg bg-teal-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {saved ? "Configuration enregistrée ✓" : "Enregistrer la configuration"}
      </button>
    </div>
  );
}

export default function AiConfigModal({ open, onClose, freeLimitReached }: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="bg-teal-600 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/15">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-white"
              >
                <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2z" />
                <circle cx="7.5" cy="14.5" r="1.5" fill="currentColor" stroke="none" />
                <circle cx="16.5" cy="14.5" r="1.5" fill="currentColor" stroke="none" />
              </svg>
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Configurer l&apos;assistant IA</h2>
              <p className="mt-0.5 text-xs text-white/70">
                {freeLimitReached
                  ? "Vous avez utilisé vos 3 générations gratuites"
                  : "Connectez votre propre clé API pour utiliser les fonctionnalités IA"}
              </p>
            </div>
          </div>
        </div>

        <div className="px-6 py-5">
          {freeLimitReached && (
            <p className="mb-4 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2.5 text-sm text-amber-900">
              Pour continuer à générer des séquences, connectez votre propre clé API ci-dessous. C&apos;est gratuit à créer.
            </p>
          )}

          <AiConfigForm onSaved={onClose} />

          {!freeLimitReached && (
            <button
              type="button"
              onClick={onClose}
              className="mt-3 w-full py-2 text-sm text-slate-400 transition hover:text-slate-600"
            >
              Configurer plus tard
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
