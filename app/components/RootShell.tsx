"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import AppShell from "./AppShell";
import CloudSyncProvider from "./CloudSyncProvider";
import ServiceWorkerRegister from "./ServiceWorkerRegister";
import AiConfigModal from "./AiConfigModal";
import { readAiConfig } from "../lib/ai-config";

export default function RootShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [showAiModal, setShowAiModal] = useState(false);
  const [freeLimitReached, setFreeLimitReached] = useState(false);
  const withoutSidebar = pathname === "/auth";

  useEffect(() => {
    const config = readAiConfig();
    if (!config) {
      setShowAiModal(true);
    }
  }, []);

  useEffect(() => {
    function handleOpenAiConfig(e: Event) {
      const detail = (e as CustomEvent<{ freeLimitReached?: boolean }>).detail;
      setFreeLimitReached(detail?.freeLimitReached ?? false);
      setShowAiModal(true);
    }
    window.addEventListener("open-ai-config", handleOpenAiConfig);
    return () => window.removeEventListener("open-ai-config", handleOpenAiConfig);
  }, []);

  return (
    <CloudSyncProvider>
      <ServiceWorkerRegister />
      <AiConfigModal
        open={showAiModal && !withoutSidebar}
        freeLimitReached={freeLimitReached}
        onClose={() => { setShowAiModal(false); setFreeLimitReached(false); }}
      />
      {withoutSidebar ? children : <AppShell>{children}</AppShell>}
    </CloudSyncProvider>
  );
}
