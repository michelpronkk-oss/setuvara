import { Bricolage_Grotesque, Geist, Geist_Mono, Instrument_Serif } from "next/font/google";

export const bricolage = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-bricolage", display: "swap", weight: ["600", "700", "800"] });
export const geist = Geist({ subsets: ["latin"], variable: "--font-geist", display: "swap" });
export const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono", display: "swap", weight: ["400", "500"] });

/** Film Appearance name only: loaded on demand, never preloaded. */
export const instrumentSerif = Instrument_Serif({ subsets: ["latin"], variable: "--font-instrument-serif", display: "swap", weight: "400", style: ["italic"], preload: false });

export const marketingFontClasses = `${bricolage.variable} ${geist.variable} ${geistMono.variable} ${instrumentSerif.variable}`;
