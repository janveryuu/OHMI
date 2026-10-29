import type { Metadata } from "next";
import { ElectronicsWorkspace } from "@/components/electronics-workspace";

export const metadata: Metadata = {
  title: "Playground",
  description: "Build and explore interactive electronic circuits with OHMI.",
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const template =
    typeof query.template === "string"
      ? query.template
      : typeof query.circuit === "string"
        ? query.circuit
        : undefined;
  const build = typeof query.build === "string" ? query.build : undefined;
  return <ElectronicsWorkspace initialTemplate={template} buildId={build} />;
}
