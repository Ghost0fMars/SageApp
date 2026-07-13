"use client";

import GenerationSpinner from "./GenerationSpinner";
import { useRotatingMessages } from "../lib/use-rotating-messages";

type Props = {
  active: boolean;
  idleLabel: string;
  messages: string[];
};

export default function GeneratingLabel({ active, idleLabel, messages }: Props) {
  const message = useRotatingMessages(active, messages);

  if (!active || !message) {
    return <>{idleLabel}</>;
  }

  return (
    <span className="inline-flex items-center justify-center gap-2">
      <GenerationSpinner />
      <span aria-live="polite">{message}</span>
    </span>
  );
}
