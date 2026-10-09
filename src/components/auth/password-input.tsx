"use client";

import { useState } from "react";

import { fieldClass } from "./auth-layout";

export function passwordScore(password: string) {
  if (!password) return 0;
  let score = 0;
  if (password.length >= 10) score += 1;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password) || password.length >= 16) score += 1;
  return Math.max(1, score);
}

const hints = ["8+ characters. A passphrase works best.", "Too easy to guess.", "Getting there.", "Strong.", "Excellent."];

export function PasswordInput({ id, label, value, onChange, autoComplete, placeholder, invalid = false, meter = false, labelAside }: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: string;
  placeholder: string;
  invalid?: boolean;
  meter?: boolean;
  labelAside?: React.ReactNode;
}) {
  const [visible, setVisible] = useState(false);
  const score = passwordScore(value);
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="flex items-baseline justify-between text-[14px]">
        <label className="font-semibold" htmlFor={id}>{label}</label>
        {labelAside}
      </div>
      <div className="relative flex">
        <input
          aria-describedby={meter ? `${id}-hint` : undefined}
          aria-invalid={invalid || undefined}
          autoComplete={autoComplete}
          className={`${fieldClass} pr-[70px] ${invalid ? "!shadow-[inset_0_0_0_1.5px_#d9372c]" : ""}`}
          id={id}
          minLength={8}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          required
          type={visible ? "text" : "password"}
          value={value}
        />
        <button aria-controls={id} aria-pressed={visible} className="absolute right-2 top-1/2 min-h-11 -translate-y-1/2 rounded-full px-3 text-[13px] font-semibold text-ink/70 hover:text-ink focus-visible:outline-2 focus-visible:outline-coral" onClick={() => setVisible((current) => !current)} type="button">
          {visible ? "Hide" : "Show"}
        </button>
      </div>
      {meter ? (
        <>
          <span aria-hidden="true" className="mt-0.5 flex gap-1">
            {[1, 2, 3, 4].map((bar) => (
              <span className={`h-[3px] flex-1 rounded-full transition-colors duration-200 ${bar <= score ? (score <= 1 ? "bg-coral" : score === 4 ? "bg-ink" : "bg-ink/60") : "bg-ink/10"}`} key={bar} />
            ))}
          </span>
          <span className="text-[13px] text-ink/65" id={`${id}-hint`}>{hints[score]}</span>
        </>
      ) : null}
    </div>
  );
}
