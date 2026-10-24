import { Suspense } from "react";
import type { Metadata } from "next";
import { LibraryGrid } from "@/components/library-grid";
export const metadata: Metadata = { title: "Circuit Library", description: "Meet 20 beginner circuit components with OHMI illustrations and sourced technical references." };
export default function Page() { return <Suspense fallback={<p role="status">Loading components…</p>}><LibraryGrid /></Suspense>; }
