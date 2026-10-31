"use client";
import Image from "next/image";
import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  House,
  MessageCircle,
  FolderOpen,
  ScanLine,
  BookOpen,
  LibraryBig,
  Cable,
  ChartNoAxesCombined,
  Settings2,
  PanelLeftClose,
  PanelLeftOpen,
  ArrowUpRight,
  Plus,
  Search,
  Sun,
  Moon,
  ChevronDown,
} from "lucide-react";
import { navigation } from "@/lib/content";
import { UserAvatar } from "./ui/user-avatar";
import { useApp } from "./app-provider";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "./ui/dialog";
import dynamic from "next/dynamic";
import { Onboarding } from "./onboarding";
const Companion = dynamic(
  () => import("./companion").then((m) => m.Companion),
  {
    loading: () => (
      <Button variant="outline" className="launch-button">
        Launch Floating OHMI
        <ArrowUpRight size={15} />
      </Button>
    ),
  }
);
import { AuthStatus, AccountNotice } from "./auth-status";
import { PwaControls } from "./pwa-controls";
import { safeReturnPath } from "@/lib/backend/guards.mjs";

const icons = {
  House,
  MessageCircle,
  FolderOpen,
  ScanLine,
  BookOpen,
  LibraryBig,
  Cable,
  ChartNoAxesCombined,
  Settings2,
};
export function AppShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname().replace(/\/$/, "") || "/",
    app = useApp(),
    systemReduced = useReducedMotion();
  const reduced = systemReduced || app.reduceMotion;
  const [collapsed, setCollapsed] = useState(false),
    [more, setMore] = useState(false),
    [search, setSearch] = useState(false),
    [query, setQuery] = useState("");
  const login = pathname === "/login";
  useEffect(() => {
    if (!login && !app.loading && !app.user) {
      const next = safeReturnPath("/app" + (pathname === "/" ? "/" : pathname + "/"));
      router.replace("/login/" + (next === "/app/" ? "" : "?next=" + encodeURIComponent(next)));
    }
  }, [login, app.loading, app.user, pathname, router]);
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const update = () => {
      document.documentElement.dataset.keyboard = String(
        viewport.height < window.innerHeight - 150 &&
          /INPUT|TEXTAREA/.test(document.activeElement?.tagName || ""),
      );
    };
    viewport.addEventListener("resize", update);
    document.addEventListener("focusin", update);
    document.addEventListener("focusout", update);
    return () => {
      viewport.removeEventListener("resize", update);
      document.removeEventListener("focusin", update);
      document.removeEventListener("focusout", update);
      delete document.documentElement.dataset.keyboard;
    };
  }, []);
  const label = pathname.startsWith("/library/")
    ? "Library"
    : pathname.startsWith("/playground/") ? "Playground"
    : navigation.find((n) => n.href === pathname)?.label || "OHMI";
  const nav = (mobile = false) =>
    navigation
      .filter((_, i) => !mobile || i < 4)
      .map((item) => {
        const Icon = icons[item.icon];
        const active =
          pathname === item.href ||
          (item.href === "/library" && pathname.startsWith("/library/")) ||
          (item.href === "/playground" && pathname.startsWith("/playground/"));
        return (
          <Link prefetch={pathname === "/playground" ? false : undefined}
            key={item.href}
            href={item.href}
            className={`nav-item ${active ? "active" : ""}`}
            aria-label={
              mobile
                ? item.href === "/"
                  ? "Home"
                  : item.href === "/checker"
                    ? "Checker"
                    : item.label
                : item.label
            }
            aria-current={active ? "page" : undefined}
            title={item.label}
            onClick={() => setMore(false)}
          >
            {active && (
              <motion.span
                className="nav-pill"
                layoutId={mobile ? "mobile-active" : "desktop-active"}
                transition={reduced ? { duration: 0 } : undefined}
              />
            )}
            <Icon size={20} strokeWidth={1.7} aria-hidden="true" />
            <span>{item.label}</span>
          </Link>
        );
      });
  if (login) return children;
  if (!app.user)
    return <main id="main" className="login-opening" role="status"><Image src="/app/mascot.png" alt="" width={80} height={80} /><p>Opening your workspace…</p></main>;
  return (
    <div className={`app-layout ${collapsed ? "compact" : ""}`}>
      <a href="#main" className="skip">
        Skip to content
      </a>
      <PwaControls statusOnly />
      <aside className="sidebar">
        <Link prefetch={pathname === "/playground" ? false : undefined} href="/" className="brand" aria-label="OHMI dashboard">
          <Image src="/app/mascot.png" alt="" width="37" height="44" />
          <span>
            OHMI<span className="brand-dot">.</span>
            <small>Your circuit buddy</small>
          </span>
        </Link>
        <div className="nav-group">
          <p className="sidebar-label">Your workspace</p>
          <nav aria-label="Main navigation">{nav()}</nav>
        </div>
        <div className="sidebar-bottom">
          <div className="companion-promo">
            <h3>A little help, anywhere.</h3>
            <p>Keep your circuit buddy close while you build.</p>
            <Companion trigger="Launch Floating OHMI" globalLauncher />
          </div>
          <Link prefetch={pathname === "/playground" ? false : undefined}
            className="profile-link"
            href="/settings"
            aria-label="Open account profile"
          >
            <UserAvatar avatarId={app.avatar} name={app.name} size={38} className="avatar" />
            <span className="profile-meta">
              <strong>{app.name || "Your account"}</strong>
              <small>{app.user?.email || "Sign in to save your work"}</small>
            </span>
            <span className="profile-chevron">
              <ChevronDown size={15} aria-hidden="true" />
            </span>
          </Link>
          <Button
            variant="ghost"
            size="icon"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            onClick={() => setCollapsed(!collapsed)}
            className="collapse-control"
          >
            {collapsed ? (
              <PanelLeftOpen size={18} />
            ) : (
              <PanelLeftClose size={18} />
            )}
          </Button>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <span>My workspace</span>
            <span className="muted">/</span>
            <strong>{label}</strong>
          </div>
          <Link prefetch={pathname === "/playground" ? false : undefined} href="/" className="mobile-brand">
            OHMI<span>.</span>
          </Link>
          <div className="row">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Search workspace"
              onClick={() => setSearch(true)}
            >
              <Search size={19} />
            </Button>
            <AuthStatus />
            <Button
              variant="ghost"
              size="icon"
              aria-label="Toggle appearance"
              onClick={() =>
                app.setTheme(
                  document.documentElement.dataset.theme === "dark"
                    ? "light"
                    : "dark",
                )
              }
            >
              {app.theme === "dark" ? <Sun size={19} /> : <Moon size={19} />}
            </Button>
            <Link prefetch={pathname === "/playground" ? false : undefined} href="/settings" aria-label="Open profile" className="avatar small-avatar"><UserAvatar avatarId={app.avatar} name={app.name} size={32} className="avatar-in-topbar" /></Link>
          </div>
        </header>
        <main id="main" className="main-content" tabIndex={-1}>
          {(pathname !== "/playground" || app.error || !app.configured) && <AccountNotice />}
          {children}
          <footer className="workspace-footer">
            <span>A little curiosity goes a long way.</span>
            <span>Made for curious minds</span>
          </footer>
        </main>
      </div>
      <nav className="bottom-nav" aria-label="Mobile navigation">
        {nav(true)}
        <button
          className={`nav-item ${more ? "active" : ""}`}
          onClick={() => setMore(true)}
          aria-label="More navigation"
        >
          <Plus size={21} />
          <span>More</span>
        </button>
      </nav>
      <Onboarding />
      <Dialog open={more} onOpenChange={setMore}>
        <DialogContent className="more-sheet">
          <DialogTitle>Your workspace</DialogTitle>
          <DialogDescription>More ways to learn with OHMI.</DialogDescription>
          <nav aria-label="More navigation" className="stack-sm">
            {navigation.slice(4).map((item) => {
              const Icon = icons[item.icon];
              return (
                <Link prefetch={pathname === "/playground" ? false : undefined}
                  className="more-link"
                  key={item.href}
                  href={item.href}
                  onClick={() => setMore(false)}
                >
                  <Icon size={20} aria-hidden="true" />
                  {item.label}
                  <ArrowUpRight size={16} aria-hidden="true" />
                </Link>
              );
            })}
          </nav>
          <Button
            variant="outline"
            onClick={() => {
              setMore(false);
              window.dispatchEvent(new Event("ohmi-launch-companion"));
            }}
          >
            Launch Floating OHMI
            <ArrowUpRight size={15} />
          </Button>
          <PwaControls />
        </DialogContent>
      </Dialog>
      <Dialog open={search} onOpenChange={setSearch}>
        <DialogContent>
          <DialogTitle>Find your next step</DialogTitle>
          <DialogDescription>
            Search the app's pages and tools.
          </DialogDescription>
          <label className="field">
            Search workspace
            <input
              className="input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Try circuit checker…"
              name="workspace-search"
              autoComplete="off"
            />
          </label>
          <div className="stack-sm">
            {navigation
              .filter((n) =>
                n.label.toLowerCase().includes(query.toLowerCase()),
              )
              .map((n) => (
                <Link prefetch={pathname === "/playground" ? false : undefined}
                  className="more-link"
                  key={n.href}
                  href={n.href}
                  onClick={() => {
                    setSearch(false);
                    setQuery("");
                  }}
                >
                  {n.label}
                  <ArrowUpRight size={16} />
                </Link>
              ))}
            {!navigation.some((n) =>
              n.label.toLowerCase().includes(query.toLowerCase()),
            ) && (
              <p className="muted">
                No pages found. Try â€œguideâ€ or â€œassignmentsâ€.
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
