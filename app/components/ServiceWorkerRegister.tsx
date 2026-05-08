"use client";

import { useEffect } from "react";

export default function ServiceWorkerRegister() {
  useEffect(() => {
    const canRegister =
      "serviceWorker" in navigator &&
      (window.location.protocol === "https:" || window.location.hostname === "localhost");

    if (!canRegister) {
      return;
    }

    navigator.serviceWorker.register("/sw.js").catch((error) => {
      console.error("Service worker registration failed", error);
    });
  }, []);

  return null;
}
