"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase, supabaseConfigured } from "../lib/supabase-client";
import { ensureLocalUser } from "../lib/user-storage";

const HELP_EMAIL = "alacle.association@gmail.com";

type ProfileForm = {
  firstName: string;
  lastName: string;
  school: string;
  email: string;
};

export default function ParametresPage() {
  const router = useRouter();
  const [form, setForm] = useState<ProfileForm>({
    firstName: "",
    lastName: "",
    school: "",
    email: ""
  });
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    async function chargerProfil() {
      if (!supabase) {
        setLoading(false);
        setMessage("Les paramètres de compte nécessitent la connexion Supabase.");
        return;
      }

      const { data } = await supabase.auth.getUser();
      const user = data.user;

      if (!user) {
        setLoading(false);
        router.replace("/auth");
        return;
      }

      setForm({
        firstName: user.user_metadata?.firstName ?? "",
        lastName: user.user_metadata?.lastName ?? user.user_metadata?.name ?? "",
        school: user.user_metadata?.school ?? "",
        email: user.email ?? ""
      });
      setLoading(false);
    }

    chargerProfil();
  }, [router]);

  function updateField(field: keyof ProfileForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function sauvegarderProfil(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!supabase) {
      setMessage("Supabase n'est pas configuré.");
      return;
    }

    setSaving(true);
    setMessage("");

    const displayName = `${form.firstName} ${form.lastName}`.trim() || form.email;
    const { error } = await supabase.auth.updateUser({
      data: {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        school: form.school.trim(),
        name: displayName
      }
    });

    setSaving(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    const { data } = await supabase.auth.getUser();
    if (data.user) {
      ensureLocalUser({ id: data.user.id, name: displayName });
    }

    setMessage("Profil enregistré.");
  }

  async function supprimerCompte() {
    if (!supabase) {
      setMessage("Supabase n'est pas configuré.");
      return;
    }

    const confirmation = window.confirm(
      "Supprimer votre compte ? Cette action efface aussi vos données associées dans Sage."
    );

    if (!confirmation) {
      return;
    }

    setDeleting(true);
    setMessage("");

    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;

    if (!token) {
      setDeleting(false);
      setMessage("Session introuvable. Reconnectez-vous avant de supprimer le compte.");
      return;
    }

    const response = await fetch("/api/delete-account", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (!response.ok) {
      const result = (await response.json()) as { error?: string };
      setDeleting(false);
      setMessage(result.error ?? "Impossible de supprimer le compte.");
      return;
    }

    await supabase.auth.signOut();
    router.replace("/auth");
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
              Gérez vos informations, votre établissement et les options liées à votre compte.
            </p>
          </div>
          <a
            href="/"
            className="rounded-md border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-100"
          >
            Tableau de bord
          </a>
        </div>

        {!supabaseConfigured && (
          <p className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
            Supabase n'est pas configuré. Cette page sera pleinement active après le déploiement.
          </p>
        )}

        <form onSubmit={sauvegarderProfil} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-xl font-bold text-slate-950">Informations personnelles</h2>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2 text-sm font-semibold text-slate-800">
              Prénom
              <input
                value={form.firstName}
                onChange={(event) => updateField("firstName", event.target.value)}
                disabled={loading}
                className="rounded-md border border-slate-300 px-3 py-3 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                placeholder="Prénom"
              />
            </label>

            <label className="grid gap-2 text-sm font-semibold text-slate-800">
              Nom
              <input
                value={form.lastName}
                onChange={(event) => updateField("lastName", event.target.value)}
                disabled={loading}
                className="rounded-md border border-slate-300 px-3 py-3 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                placeholder="Nom"
              />
            </label>

            <label className="grid gap-2 text-sm font-semibold text-slate-800 sm:col-span-2">
              École
              <input
                value={form.school}
                onChange={(event) => updateField("school", event.target.value)}
                disabled={loading}
                className="rounded-md border border-slate-300 px-3 py-3 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                placeholder="Nom de l'école ou de l'établissement"
              />
            </label>

            <label className="grid gap-2 text-sm font-semibold text-slate-800 sm:col-span-2">
              Email de connexion
              <input
                value={form.email}
                disabled
                className="rounded-md border border-slate-300 bg-slate-100 px-3 py-3 text-sm text-slate-700"
              />
            </label>
          </div>

          {message && (
            <p className="mt-4 rounded-md bg-slate-100 p-3 text-sm text-slate-700">{message}</p>
          )}

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={loading || saving}
              className="rounded-md bg-teal-700 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {saving ? "Enregistrement..." : "Enregistrer"}
            </button>
            <a
              href={`mailto:${HELP_EMAIL}?subject=Aide%20Sage`}
              className="rounded-md border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-100"
            >
              Demander de l'aide
            </a>
          </div>
        </form>

        <section className="mt-6 rounded-lg border border-red-200 bg-white p-5 shadow-sm">
          <h2 className="text-xl font-bold text-slate-950">Suppression du compte</h2>
          <p className="mt-2 leading-7 text-slate-700">
            La suppression retire votre compte et les données associées. Cette action est définitive.
          </p>
          <button
            type="button"
            onClick={supprimerCompte}
            disabled={deleting}
            className="mt-4 rounded-md bg-red-700 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-red-800 disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            {deleting ? "Suppression..." : "Supprimer mon compte"}
          </button>
        </section>
      </section>
    </main>
  );
}
