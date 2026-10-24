import type { Metadata } from "next";
import { Playground } from "@/components/playground";
export const metadata: Metadata = {
  title: "Playground",
  description: "Build and explore supported beginner LED circuits with OHMI.",
};
export default function Page() {
  return <Playground />;
}
