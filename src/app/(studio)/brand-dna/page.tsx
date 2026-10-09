import type { Metadata } from "next";
import { BrandDnaView } from "@/components/brand-dna/brand-dna-view";

export const metadata: Metadata = { title: "Brand DNA" };

export default function BrandDnaPage() {
  return <BrandDnaView />;
}
