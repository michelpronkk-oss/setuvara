"use client";

import { useState } from "react";

import { FeedbackSheet } from "@/components/app/feedback-sheet";
import { HomeScreenSheet, useStandalone } from "@/components/app/home-screen";

// The two settings rows that open a sheet instead of a page.
export function SettingsAppActions({ rowClassName }: { rowClassName: string }) {
  const [open, setOpen] = useState<"home" | "feedback" | null>(null);
  const standalone = useStandalone();
  return (
    <>
      <button className={rowClassName} onClick={() => setOpen("home")} type="button">
        <span className="min-w-0"><span className="block text-[15px] font-semibold">{standalone ? "Home Screen app" : "Add to Home Screen"}</span><span className="mt-0.5 block text-[13px] text-black/55">Open Share in one tap.</span></span>
        <Chevron />
      </button>
      <button className={rowClassName} onClick={() => setOpen("feedback")} type="button">
        <span className="min-w-0"><span className="block text-[15px] font-semibold">Send feedback</span><span className="mt-0.5 block text-[13px] text-black/55">Straight to the team.</span></span>
        <Chevron />
      </button>
      {open === "home" && <HomeScreenSheet onClose={() => setOpen(null)} />}
      {open === "feedback" && <FeedbackSheet onClose={() => setOpen(null)} />}
    </>
  );
}

export function Chevron() {
  return <svg aria-hidden="true" className="shrink-0 text-black/35" fill="none" height="16" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 16 16" width="16"><path d="m6 3.5 4.5 4.5L6 12.5" /></svg>;
}
