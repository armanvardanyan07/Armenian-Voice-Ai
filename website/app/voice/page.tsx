import type { Metadata } from "next";
import { ArmenianSite } from "../components/ArmenianSite";

export const metadata: Metadata = {
  title: "Voice",
  description: "A direct Armenian voice conversation.",
};

export default function VoicePage() {
  return <ArmenianSite kind="voice" />;
}
