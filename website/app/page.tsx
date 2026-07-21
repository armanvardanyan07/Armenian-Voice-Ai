import type { Metadata } from "next";
import { ArmenianSite } from "./components/ArmenianSite";

export const metadata: Metadata = {
  title: { absolute: "Armenian AI — Armenian-first voice intelligence" },
  description:
    "Armenian-first voice and language intelligence for people, businesses, and products.",
};

export default function Home() {
  return <ArmenianSite kind="home" />;
}
