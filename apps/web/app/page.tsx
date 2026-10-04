import type { Metadata } from "next";
import { Landing, landingMetadata } from "./landing";

export function generateMetadata(): Metadata {
  return landingMetadata("tr");
}

/** The Turkish landing; the English one lives at /en (app/en/page.tsx). */
export default function HomePage() {
  return <Landing locale="tr" />;
}
