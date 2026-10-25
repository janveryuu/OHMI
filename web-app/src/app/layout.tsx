import type { Metadata, Viewport } from "next";
import "@fontsource-variable/geist";
import "./globals.css";
import "katex/dist/katex.min.css";
import { AppProvider } from "@/components/app-provider";
import { AppFrame } from "@/components/app-frame";

export const metadata: Metadata = {
  title: { default: "OHMI | Your Circuit Buddy", template: "%s | OHMI" },
  description:
    "Your personal workspace for learning circuits. Saved assignments, circuit guidance, and a private learning workspace.",
  applicationName: "OHMI",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "OHMI" },
  icons: {
    icon: "/app/icons/icon-192.png",
    apple: "/app/icons/apple-touch-icon.png",
  },
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f8f7" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0c0f" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var p=JSON.parse(localStorage.getItem('ohmi-preferences')||'{}');var t=['light','dark','system'].includes(p.theme)?p.theme:'light';document.documentElement.dataset.theme=t==='system'?(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):t;document.documentElement.dataset.reduceMotion=String(p.reduceMotion===true);document.documentElement.dataset.largeText=String(p.largeText===true)}catch(e){}`,
          }}
        />
      </head>
      <body>
        <AppProvider>
          <AppFrame>{children}</AppFrame>
        </AppProvider>
      </body>
    </html>
  );
}
