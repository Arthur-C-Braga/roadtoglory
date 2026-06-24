import { Anton, Saira, Saira_Condensed } from "next/font/google";

// "Road to Glory" (Champions) identity — three Google faces.
// Anton: display/numerals · Saira: body/UI · Saira Condensed: eyebrows, labels, buttons.
export const anton = Anton({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-anton",
  display: "swap",
});
export const saira = Saira({
  weight: ["300", "400", "500", "600", "700", "800", "900"],
  subsets: ["latin"],
  variable: "--font-saira",
  display: "swap",
});
export const sairaCondensed = Saira_Condensed({
  weight: ["600", "700", "800", "900"],
  subsets: ["latin"],
  variable: "--font-saira-condensed",
  display: "swap",
});

export const fontVars = [
  anton.variable,
  saira.variable,
  sairaCondensed.variable,
].join(" ");
