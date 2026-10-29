import type { Metadata } from "next";
import { ElectronicsWorkspace } from "@/components/electronics-workspace";

export const metadata: Metadata = { title: "Electronics workspace" };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const build = query.build;
  const template =
    typeof query.template === "string"
      ? query.template
      : typeof query.circuit === "string"
        ? query.circuit
        : undefined;
  return (
    <ElectronicsWorkspace
      initialTemplate={template}
      buildId={typeof build === "string" ? build : undefined}
    />
  );
}
