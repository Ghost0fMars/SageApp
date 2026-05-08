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
  const withoutSidebar = pathname === "/auth";

  useEffect(() => {
    const config = readAiConfig();
    if (!config) {
      setShowAiModal(true);
    }
  }, []);

  return (
    <CloudSyncProvider>
      <ServiceWorkerRegister />
      <AiConfigModal open={showAiModal} onClose={() => setShowAiModal(false)} />
      {withoutSidebar ? children : <AppShell>{children}</AppShell>}
    </CloudSyncProvider>
  );
}
