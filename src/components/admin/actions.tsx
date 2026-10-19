"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import type { FeedbackStatus } from "@/lib/admin/data";

const small = "inline-flex h-8 items-center rounded-full px-3 text-[12px] font-semibold shadow-[0_0_0_1px_rgba(13,13,13,.14)] transition-colors hover:bg-ink/[0.04] disabled:cursor-wait disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";

export function CopyButton({ value, label = "Copy ID" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      className={small}
      onClick={() => {
        void navigator.clipboard.writeText(value).then(() => {
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1500);
        });
      }}
      type="button"
    >
      {copied ? "Copied" : label}
    </button>
  );
}

type CheckResult = { id: string; result: "found" | "not_found" | "error"; providerStatus?: string; stored: string };

export function ProviderCheck({ memberId }: { memberId: string }) {
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [results, setResults] = useState<CheckResult[]>([]);
  const [message, setMessage] = useState("");

  async function run() {
    setState("busy");
    setMessage("");
    try {
      const response = await fetch(`/api/admin/members/${memberId}/provider-check`, { method: "POST", headers: { accept: "application/json" } });
      const body = await response.json().catch(() => ({})) as { results?: CheckResult[]; error?: string };
      if (!response.ok || !body.results) {
        setState("error");
        setMessage(body.error === "provider_unconfigured" ? "Dodo isn’t configured on this deployment." : "Dodo couldn’t be reached. Nothing changed.");
        return;
      }
      setResults(body.results);
      setState("done");
    } catch {
      setState("error");
      setMessage("Dodo couldn’t be reached. Nothing changed.");
    }
  }

  return (
    <div>
      <button className={small} disabled={state === "busy"} onClick={() => void run()} type="button">
        {state === "busy" ? "Checking Dodo…" : state === "done" ? "Check again" : "Verify with Dodo"}
      </button>
      {state === "error" ? <p className="mt-2 text-[12px] text-[#b3261e]" role="alert">{message}</p> : null}
      {state === "done" ? (
        <ul className="mt-2 space-y-1 text-[12px]">
          {results.length === 0 ? <li className="text-ink/55">No subscription rows to check.</li> : results.map((result) => (
            <li className="flex flex-wrap gap-x-2" key={result.id}>
              <code className="font-label text-[11.5px] text-ink/60">{result.id}</code>
              <span className={result.result === "found" ? "text-[#1d6b34]" : result.result === "not_found" ? "text-[#7a5300]" : "text-[#b3261e]"}>
                {result.result === "found" ? `Known to Dodo · ${result.providerStatus}` : result.result === "not_found" ? "Not at Dodo: granted by hand" : "Lookup failed"}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

const NEXT_STATUS: Record<FeedbackStatus, { status: FeedbackStatus; label: string }[]> = {
  open: [{ status: "reviewing", label: "Start review" }, { status: "done", label: "Mark done" }],
  reviewing: [{ status: "done", label: "Mark done" }, { status: "open", label: "Reopen" }],
  done: [{ status: "open", label: "Reopen" }],
};

export function FeedbackStatusActions({ id, status }: { id: string; status: FeedbackStatus }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function move(next: FeedbackStatus) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/feedback/${id}/status`, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (!response.ok) throw new Error("update_failed");
      router.refresh();
    } catch {
      setError("Couldn’t update. Nothing changed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {NEXT_STATUS[status].map((option) => (
        <button className={option.status === "done" ? `${small} bg-ink text-paper shadow-none hover:bg-ink/85` : small} disabled={busy} key={option.status} onClick={() => void move(option.status)} type="button">
          {option.label}
        </button>
      ))}
      {error ? <span className="text-[12px] text-[#b3261e]" role="alert">{error}</span> : null}
    </div>
  );
}
