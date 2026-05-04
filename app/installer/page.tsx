"use client";

import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

export default function InstallerPage() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      ("standalone" in window.navigator && Boolean(window.navigator.standalone));

    setIsStandalone(standalone);

    function handleBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    }

    function handleAppInstalled() {
      setInstallPrompt(null);
      setIsStandalone(true);
      setMessage("Sage est maintenant installée sur cet appareil.");
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  async function installerApplication() {
    if (!installPrompt) {
      setMessage(
        "Si le bouton d'installation automatique n'apparaît pas, ouvrez le menu du navigateur puis choisissez Ajouter à l'écran d'accueil ou Installer l'application."
      );
      return;
    }

    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;

    if (choice.outcome === "accepted") {
      setInstallPrompt(null);
      setIsStandalone(true);
      setMessage("Sage est maintenant installée sur cet appareil.");
    } else {
      setMessage("Installation annulée. Vous pouvez relancer l'installation quand vous le souhaitez.");
    }
  }

  return (
    <main className="min-h-screen bg-[#f5f7f2] px-5 py-8 text-[#17382d]">
      <section className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-3xl flex-col justify-center">
        <div className="rounded-2xl border border-[#c7d8ce] bg-white p-6 shadow-sm sm:p-10">
          <div className="mb-8 flex items-center gap-4">
            <div className="h-16 w-16 overflow-hidden rounded-2xl bg-white shadow-sm">
              <img src="/sage-logo.png" alt="Sage" className="h-full w-full object-cover" />
            </div>
            <div>
              <p className="text-sm font-bold uppercase tracking-wide text-[#3f7f62]">Sage</p>
              <h1 className="text-3xl font-black sm:text-4xl">Installer l'application</h1>
            </div>
          </div>

          {isStandalone ? (
            <div className="rounded-xl bg-[#f0fdfa] p-5 font-semibold text-[#17382d]">
              Sage est déjà installée ou ouverte comme application sur cet appareil.
            </div>
          ) : (
            <>
              <p className="text-lg leading-8 text-[#29483d]">
                Installez Sage sur votre téléphone, tablette ou ordinateur pour l'ouvrir comme une application, directement depuis l'écran d'accueil ou le bureau.
              </p>

              <button
                type="button"
                onClick={installerApplication}
                className="mt-8 w-full rounded-xl bg-[#f4b400] px-5 py-4 text-base font-black text-black shadow-sm transition hover:bg-[#e2a800] sm:w-auto"
              >
                Installer Sage
              </button>

              {message && (
                <p className="mt-5 rounded-xl border border-[#c7d8ce] bg-[#f8faf7] p-4 text-sm font-semibold leading-6 text-[#29483d]">
                  {message}
                </p>
              )}

              <div className="mt-8 grid gap-4 text-sm leading-6 text-[#29483d] sm:grid-cols-2">
                <div className="rounded-xl border border-[#d6e2da] bg-[#f8faf7] p-4">
                  <h2 className="mb-2 font-black text-[#17382d]">Sur Android</h2>
                  <p>Ouvrez le menu du navigateur, puis choisissez Installer l'application ou Ajouter à l'écran d'accueil.</p>
                </div>
                <div className="rounded-xl border border-[#d6e2da] bg-[#f8faf7] p-4">
                  <h2 className="mb-2 font-black text-[#17382d]">Sur iPhone</h2>
                  <p>Ouvrez Safari, touchez Partager, puis choisissez Sur l'écran d'accueil.</p>
                </div>
              </div>
            </>
          )}

          <a
            href="/"
            className="mt-8 inline-flex font-bold text-[#1e3a2e] underline-offset-4 hover:underline"
          >
            Ouvrir Sage dans le navigateur
          </a>
        </div>
      </section>
    </main>
  );
}

