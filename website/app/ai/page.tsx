import type { Metadata } from "next";
import { ArmenianSite } from "../components/ArmenianSite";

export const metadata: Metadata = {
  title: "Intelligence",
  description: "Armenian language intelligence built around meaning and conversational context.",
};

export default function IntelligencePage() {
  return <ArmenianSite kind="ai" />;
}
