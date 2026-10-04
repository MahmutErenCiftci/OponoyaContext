import type { Metadata } from "next";
import { Landing, landingMetadata } from "../landing";

export function generateMetadata(): Metadata {
  return landingMetadata("en");
}

/** The English landing; the Turkish one lives at / (app/page.tsx). */
export default function EnglishHomePage() {
  return <Landing locale="en" />;
}
