import type { Metadata } from "next";
import { ElectronicsWorkspace } from "@/components/electronics-workspace";
export const metadata: Metadata = { title: "Electronics workspace preview" };
export default function Page() { return <ElectronicsWorkspace />; }
