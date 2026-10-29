import type { Metadata } from "next";
import { ElectronicsWorkspace } from "@/components/electronics-workspace";
export const metadata: Metadata = { title: "Electronics workspace preview" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const build = (await searchParams).build;
  return (
    <ElectronicsWorkspace
      buildId={typeof build === "string" ? build : undefined}
    />
  );
}
