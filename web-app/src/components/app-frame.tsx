"use client";
import type { ReactNode } from "react";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";

const WorkspaceShell = dynamic(() =>
  import("./app-shell").then((module) => module.AppShell),
);

export function AppFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname().replace(/\/$/, "");
  return pathname === "/login" ? children : <WorkspaceShell>{children}</WorkspaceShell>;
}
