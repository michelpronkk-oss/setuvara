"use client";

import { useSyncExternalStore } from "react";

const noSubscription = () => () => {};

/** Greets by the visitor's own clock; the server render says Hello until it hydrates. */
export function CreatorGreeting({ firstName }: { firstName: string }) {
  const word = useSyncExternalStore(noSubscription, () => {
    const hour = new Date().getHours();
    return hour < 5 ? "Evening" : hour < 12 ? "Morning" : hour < 18 ? "Afternoon" : "Evening";
  }, () => "Hello");
  return <>{word}, {firstName}.</>;
}
