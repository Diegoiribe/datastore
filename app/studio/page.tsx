import type { Metadata } from "next";
import Reports from "../page";

export const metadata: Metadata = {
  title: "Studio · Macintosh Studio",
  description: "Editor y compositor de reportes de Macintosh Studio.",
};

export default function StudioPage() {
  return <Reports studioMode />;
}
