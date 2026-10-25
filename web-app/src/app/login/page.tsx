import type { Metadata } from "next";
import { Login } from "@/components/login";
import "./login.css";

export const metadata: Metadata = { title: "Welcome", robots: { index: false, follow: false } };

export default function LoginPage() {
  return <Login />;
}
