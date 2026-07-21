import type { Metadata } from "next";
import { ArmenianSite } from "../components/ArmenianSite";

export const metadata: Metadata = {
  title: "API",
  description: "A local design preview of the future Armenian AI developer interface.",
};

export default function ApiPage() {
  return <ArmenianSite kind="api" />;
}
