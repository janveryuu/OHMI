import type { Metadata } from "next";
import { Playground } from "@/components/playground";
import { ElectronicsWorkspace } from "@/components/electronics-workspace";
export const metadata: Metadata = {
  title: "Playground",
  description: "Build and explore supported beginner LED circuits with OHMI.",
};
export default async function Page({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}) {
  const query=await searchParams;
  if(query.legacy==='1' || query.template || query.circuit)return <Playground />;
  return <ElectronicsWorkspace buildId={typeof query.build==='string'?query.build:undefined}/>;
}
