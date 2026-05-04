"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { getCurrentUser, type LocalUser } from "../lib/user-storage";
import { supabase, supabaseConfigured } from "../lib/supabase-client";
import AssistantChat from "./AssistantChat";

const iconProps = {
  width: 18,
  height: 18,
  viewBox: "0 0 20 20",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const
};

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

const icons = {
  dashboard: (
    <svg {...iconProps}>
      <rect x="2" y="2" width="7" height="7" rx="1.5" />
      <rect x="11" y="2" width="7" height="7" rx="1.5" />
      <rect x="2" y="11" width="7" height="7" rx="1.5" />
      <rect x="11" y="11" width="7" height="7" rx="1.5" />
    </svg>
  ),
  pencil: (
    <svg {...iconProps}>
      <path d="M14 3l3 3L6 17H3v-3L14 3z" />
      <path d="M12 5l3 3" />
    </svg>
  ),
  calendar: (
    <svg {...iconProps}>
      <rect x="2" y="3.5" width="16" height="14.5" rx="2" />
      <path d="M2 8.5h16M6.5 2v3M13.5 2v3" />
    </svg>
  ),
  books: (
    <svg {...iconProps}>
      <rect x="2" y="3" width="4" height="14" rx="1" />
      <rect x="8" y="5" width="4" height="12" rx="1" />
      <rect x="14" y="2" width="4" height="16" rx="1" />
    </svg>
  ),
  chart: (
    <svg {...iconProps}>
      <path d="M2 18h16" />
      <rect x="3" y="12" width="3.5" height="6" rx="0.75" />
      <rect x="8.25" y="8" width="3.5" height="10" rx="0.75" />
      <rect x="13.5" y="4" width="3.5" height="14" rx="0.75" />
    </svg>
  ),
  person: (
    <svg {...iconProps}>
      <circle cx="10" cy="6" r="3.5" />
      <path d="M3 19c0-4 3.1-7 7-7s7 3 7 7" />
    </svg>
  ),
  sliders: (
    <svg {...iconProps}>
      <path d="M2 5h16M2 10h16M2 15h16" />
      <circle cx="6" cy="5" r="2" />
      <circle cx="14" cy="10" r="2" />
      <circle cx="8" cy="15" r="2" />
    </svg>
  ),
  login: (
    <svg {...iconProps}>
      <path d="M8 4H5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h3" />
      <path d="M12 6l4 4-4 4" />
      <path d="M7 10h9" />
    </svg>
  ),
  download: (
    <svg {...iconProps}>
      <path d="M10 2v10" />
      <path d="M6 8l4 4 4-4" />
      <path d="M3 14v2a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2" />
    </svg>
  )
};

const navigation: { href: string; label: string; icon: React.ReactNode }[] = [
  { href: "/", label: "Tableau de bord", icon: icons.dashboard },
  { href: "/preparation", label: "Préparer", icon: icons.pencil },
  { href: "/planning", label: "Planning", icon: icons.calendar },
  { href: "/bibliotheque", label: "Bibliothèque", icon: icons.books },
  { href: "/progression", label: "Progression", icon: icons.chart },
  { href: "/eleves", label: "Élèves & suivi", icon: icons.person },
  { href: "/parametres", label: "Paramètres", icon: icons.sliders }
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [user, setUser] = useState<LocalUser | null>(null);
  const [cloudEmail, setCloudEmail] = useState<string | null>(null);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    setUser(getCurrentUser());
    setMobileMenuOpen(false);
  }, [pathname, cloudEmail]);

  useEffect(() => {
    setIsStandalone(
      window.matchMedia("(display-mode: standalone)").matches ||
        ("standalone" in window.navigator && Boolean(window.navigator.standalone))
    );

    function handleBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    }

    function handleAppInstalled() {
      setInstallPrompt(null);
      setIsStandalone(true);
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  useEffect(() => {
    if (!supabase) {
      return;
    }

    supabase.auth.getUser().then(({ data }) => {
      setCloudEmail(data.user?.email ?? null);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setCloudEmail(session?.user.email ?? null);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  async function installerApplication() {
    if (!installPrompt) {
      window.alert(
        "Pour installer Sage, ouvrez le menu du navigateur puis choisissez Ajouter à l'écran d'accueil ou Installer l'application."
      );
      return;
    }

    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;

    if (choice.outcome === "accepted") {
      setInstallPrompt(null);
      setIsStandalone(true);
    }
  }

  async function deconnecter() {
    if (!supabase) {
      return;
    }

    await supabase.auth.signOut();
    setCloudEmail(null);
    window.location.href = "/auth";
  }

  const sidebar = (
    <>
      <div className="px-2">
        <p className="font-bold text-white">Sage</p>
        <p className="text-xs text-white/50">Portail enseignant</p>
      </div>

      {!isStandalone && (
        <button
          type="button"
          onClick={installerApplication}
          className="mt-5 flex w-full items-center gap-3 rounded-lg bg-teal-600 px-3 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-700"
        >
          <span className="flex w-5 items-center justify-center">{icons.download}</span>
          Installer Sage
        </button>
      )}

      <nav className="mt-6 grid gap-1">
        {navigation.map((item) => {
          const active = pathname === item.href;

          return (
            <a
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-semibold transition ${
                active
                  ? "bg-teal-600 text-white shadow-sm"
                  : "text-white/60 hover:bg-white/10 hover:text-white"
              }`}
            >
              <span className="flex w-5 items-center justify-center">{item.icon}</span>
              {item.label}
            </a>
          );
        })}

        {supabaseConfigured && !cloudEmail && (
          <a
            href="/auth"
            className={`flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-semibold transition ${
              pathname === "/auth"
                ? "bg-teal-600 text-white shadow-sm"
                : "text-white/60 hover:bg-white/10 hover:text-white"
            }`}
          >
            <span className="flex w-5 items-center justify-center">{icons.login}</span>
            Connexion
          </a>
        )}
      </nav>

      <div className="mt-auto grid gap-4 pt-8">
        <div className="grid gap-2 border-t border-white/10 pt-5 text-xs font-semibold text-white/55">
          <a
            href="https://alacle.org"
            target="_blank"
            rel="noreferrer"
            className="rounded-md px-3 py-2 transition hover:bg-white/10 hover:text-white"
          >
            alacle.org
          </a>
          <a
            href="/politique-confidentialite"
            className="rounded-md px-3 py-2 transition hover:bg-white/10 hover:text-white"
          >
            Politique de confidentialité
          </a>
        </div>

        <div className="w-full max-w-full rounded-xl bg-white/5 p-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-teal-600 font-bold text-white">
              {user?.name?.charAt(0).toUpperCase() ?? "U"}
            </div>
            <div className="min-w-0 flex-1 overflow-hidden">
              <p className="whitespace-normal break-words text-sm font-semibold leading-5 text-white [overflow-wrap:anywhere]">
                {user?.name ?? "Utilisateur"}
              </p>
              <p className="mt-0.5 whitespace-normal break-words text-xs leading-4 text-white/50 [overflow-wrap:anywhere]" title={cloudEmail ?? undefined}>
                {cloudEmail ?? "Données locales"}
              </p>
            </div>
          </div>

          {supabaseConfigured && cloudEmail && (
            <button
              type="button"
              onClick={deconnecter}
              className="mt-4 w-full rounded-lg border border-white/15 px-3 py-2.5 text-sm font-semibold text-white/75 transition hover:bg-white/10 hover:text-white"
            >
              Déconnexion
            </button>
          )}
        </div>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950 lg:grid lg:grid-cols-[260px_minmax(0,1fr)]">
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-slate-200 bg-slate-50/95 px-4 py-3 backdrop-blur lg:hidden">
        <div>
          <p className="font-bold text-slate-950">Sage</p>
          <p className="text-xs text-slate-500">Portail enseignant</p>
        </div>
        <button
          type="button"
          onClick={() => setMobileMenuOpen(true)}
          aria-label="Ouvrir le menu"
          className="grid h-11 w-11 place-items-center rounded-lg bg-slate-950 text-white shadow-sm transition hover:bg-teal-700"
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <path d="M4 7h16" />
            <path d="M4 12h16" />
            <path d="M4 17h16" />
          </svg>
        </button>
      </header>

      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Fermer le menu"
            className="absolute inset-0 bg-slate-950/60"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="relative flex h-full w-[min(82vw,320px)] flex-col bg-slate-950 px-4 py-5 shadow-2xl">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              aria-label="Fermer le menu"
              className="absolute right-4 top-5 z-10 grid h-10 w-10 place-items-center rounded-lg text-white/70 transition hover:bg-white/10 hover:text-white"
            >
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <path d="M6 6l12 12" />
                <path d="M18 6L6 18" />
              </svg>
            </button>
            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto pr-1">{sidebar}</div>
          </aside>
        </div>
      )}

      <aside className="hidden h-screen min-h-screen flex-col overflow-y-auto bg-slate-950 px-4 py-5 lg:sticky lg:top-0 lg:flex">
        {sidebar}
      </aside>

      <div className="min-w-0">{children}</div>
      <AssistantChat />
    </div>
  );
}