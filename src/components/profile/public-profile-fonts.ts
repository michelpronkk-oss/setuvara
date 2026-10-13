import { Bricolage_Grotesque, Geist, Geist_Mono, Instrument_Serif } from "next/font/google";

// Public profiles retain the same font faces and variables as marketing pages. They are not
// preloaded here: the browser fetches only the faces used by the selected profile appearance.
const bricolage = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-bricolage", display: "swap", weight: ["600", "700", "800"], preload: false });
const geist = Geist({ subsets: ["latin"], variable: "--font-geist", display: "swap", preload: false });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono", display: "swap", weight: ["400", "500"], preload: false });
const instrumentSerif = Instrument_Serif({ subsets: ["latin"], variable: "--font-instrument-serif", display: "swap", weight: "400", style: ["italic"], preload: false });

export const publicProfileFontClasses = `${bricolage.variable} ${geist.variable} ${geistMono.variable} ${instrumentSerif.variable}`;
