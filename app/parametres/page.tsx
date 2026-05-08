"use client";

import { FormEvent, useEffect, useState } from "react";
import { AiConfigForm } from "../components/AiConfigModal";

const PROFILE_KEY = "sage-profile";
const HELP_EMAIL = "alacle.association@gmail.com";

type Profile = {
  firstName: string;
  lastName: string;
  school: string;
};

export default function ParametresPage() {
  const [form, setForm] = useState<Profile>({
    firstName: "",
    lastName: "",
    school: "",
  });
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(PROFILE_KEY);
      if (stored) {
        const profile = JSON.parse(stored) as Profile;
        setForm(profile);
      }
    } catch {
      // ignore
    }
  }, []);

  function updateField(field: keyof Profile, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function sauvegarderProfil(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");

    try {
      localStorage.setItem(
        PROFILE_KEY,
        JSON.stringify({
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          school: form.school.trim(),
        })
      );
      setMessage("Profil enregistré.");
    } catch {
      setMessage("Impossible d'enregistrer le profil.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
      <section className="mx-auto max-w-3xl">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-teal-700">
              Paramètres
            </p>
            <h1 className="mt-2 text-3xl font-bold text-slate-950">Compte enseignant</h1>
            <p className="mt-2 leading-7 text-slate-700">
              Gérez vos informations personnelles et la configuration de l&apos;IA.
            </p>
          </div>
          <a
            href="/"
            className="rounded-md border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-100"
          >
            Tableau de bord
          </a>
        </div>

        <form
          onSubmit={sauvegarderProfil}
          className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
        >
          <h2 className="text-xl font-bold text-slate-950">Informations personnelles</h2>
          <p className="mt-1 text-sm text-slate-500">
            Stockées uniquement sur votre ordinateur.
          </p>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2 text-sm font-semibold text-slate-800">
              Prénom
              <input
                value={form.firstName}
                onChange={(event) => updateField("firstName", event.target.value)}
                className="rounded-md border border-slate-300 px-3 py-3 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                placeholder="Prénom"
              />
            </label>

            <label className="grid gap-2 text-sm font-semibold text-slate-800">
              Nom
              <input
                value={form.lastName}
                onChange={(event) => updateField("lastName", event.target.value)}
                className="rounded-md border border-slate-300 px-3 py-3 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                placeholder="Nom"
              />
            </label>

            <label className="grid gap-2 text-sm font-semibold text-slate-800 sm:col-span-2">
              École
              <input
                value={form.school}
                onChange={(event) => updateField("school", event.target.value)}
                className="rounded-md border border-slate-300 px-3 py-3 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                placeholder="Nom de l'école ou de l'établissement"
              />
            </label>
          </div>

          {message && (
            <p className="mt-4 rounded-md bg-slate-100 p-3 text-sm text-slate-700">{message}</p>
          )}

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-teal-700 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {saving ? "Enregistrement..." : "Enregistrer"}
            </button>
            <a
              href={`mailto:${HELP_EMAIL}?subject=Aide%20Sage`}
              className="rounded-md border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-100"
            >
              Demander de l&apos;aide
            </a>
          </div>
        </form>

        <section className="mt-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-xl font-bold text-slate-950">Assistant IA</h2>
          <p className="mt-2 leading-7 text-slate-700">
            Choisissez le fournisseur IA et collez votre clé API. La clé est stockée uniquement sur
            votre ordinateur et n&apos;est jamais transmise à nos serveurs.
          </p>
          <div className="mt-5">
            <AiConfigForm />
          </div>
        </section>
      </section>
    </main>
  );
}
