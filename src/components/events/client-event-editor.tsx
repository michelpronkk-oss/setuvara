"use client";

import dynamic from "next/dynamic";

// Only the browser knows the organizer's own time zone, tomorrow's date and its list of zones.
export const ClientEventEditor = dynamic(() => import("./event-editor").then((module) => module.EventEditor), {
  ssr: false,
  loading: () => <div aria-hidden="true" className="h-[720px] animate-pulse rounded-[24px] bg-black/[0.04]" />,
});
