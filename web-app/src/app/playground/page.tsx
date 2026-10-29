import type { Metadata } from "next";
import { Playground } from "@/components/playground";
import { ElectronicsWorkspace } from "@/components/electronics-workspace";
export const metadata: Metadata = {
  title: "Playground",
  description: "Build and explore supported beginner LED circuits with OHMI.",
};
export default async function Page({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}) {
  const query=await searchParams;
  const template =
    typeof query.template === "string"
      ? query.template
      : typeof query.circuit === "string"
        ? query.circuit
        : undefined;
  if(query.legacy==='1' || template)return <Playground initialTemplate={template} />;
  return <ElectronicsWorkspace buildId={typeof query.build==='string'?query.build:undefined}/>;
}

