import type { Metadata } from "next";
import { SpikeVoz } from "./spike-voz";

export const metadata: Metadata = { title: "Jarvis" };

/**
 * Fora da navegacao de proposito: e um teste, alcancado digitando /jarvis.
 * Vira item de menu quando deixar de ser spike.
 */
export default function JarvisPage() {
  return <SpikeVoz />;
}
