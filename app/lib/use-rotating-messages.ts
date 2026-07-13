"use client";

import { useEffect, useState } from "react";

export function useRotatingMessages(active: boolean, messages: string[], intervalMs = 1900) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!active || messages.length <= 1) {
      setIndex(0);
      return;
    }

    const id = setInterval(() => {
      setIndex((current) => (current + 1) % messages.length);
    }, intervalMs);

    return () => clearInterval(id);
  }, [active, messages, intervalMs]);

  return active ? messages[index % messages.length] : null;
}
