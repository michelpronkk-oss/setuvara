import { Bricolage_Grotesque } from "next/font/google";

// Passport's display type is set with Bricolage's optical-size axis (as in the Passport .dc): large
// numerals use the tighter display cut. Scoped to Passport by redefining --font-bricolage on its root.
export const passportDisplay = Bricolage_Grotesque({ subsets: ["latin"], axes: ["opsz"], variable: "--font-bricolage", display: "swap" });
