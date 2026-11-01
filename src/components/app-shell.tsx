"use client";

import * as RadixDialog from "@radix-ui/react-dialog";
import {
  Banknote,
  Database,
  Layers,
  LayoutDashboard,
  Menu,
  Moon,
  Search,
  Settings2,
  Sun,
  Target,
  TrendingUp,
  UserSearch,
  Video,
  X,
} from "lucide-react";
import { useTheme } from "next-themes";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { CommandPalette } from "@/components/command-palette";
import { Button } from "@/components/ui/button";
import { Tip } from "@/components/ui/tooltip";
import { useNow } from "@/lib/clock";
import { formatISTPattern } from "@/lib/format";
import { COACH } from "@/lib/mock/config";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/webinars", label: "Webinars", icon: Video },
  { href: "/segments", label: "Segments & follow-ups", icon: Layers },
  { href: "/trends", label: "Trends", icon: TrendingUp },
  { href: "/attribution", label: "Attribution", icon: Target },
  { href: "/people", label: "People", icon: UserSearch },
  { href: "/sales", label: "Sales & calls", icon: Banknote },
  { href: "/system", label: "System", icon: Settings2 },
];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex size-8 items-end justify-center gap-[3px] rounded-[9px] bg-ink p-[7px]" aria-hidden>
        <span className="w-[3px] rounded-full bg-surface" style={{ height: "100%" }} />
        <span className="w-[3px] rounded-full bg-surface/80" style={{ height: "70%" }} />
        <span className="w-[3px] rounded-full bg-surface/60" style={{ height: "42%" }} />
      </div>
      <div className="leading-tight">
        <div className="text-[15px] font-semibold tracking-tight">Funnel Engine</div>
        <div className="text-[11px] text-ink-3">Webinar command centre</div>
      </div>
    </div>
  );
}

function NavList({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <nav aria-label="Main" className="flex flex-col gap-0.5">
      {NAV.map((item) => {
        const active = isActive(pathname, item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-[13.5px] font-medium transition-colors",
              active ? "bg-surface text-ink shadow-sm ring-1 ring-line" : "text-ink-2 hover:bg-surface-3 hover:text-ink",
            )}
          >
            {active ? <span className="absolute left-0 top-2 h-5 w-[3px] rounded-r-full bg-accent" aria-hidden /> : null}
            <Icon className={cn("size-[17px]", active ? "text-accent" : "text-ink-3 group-hover:text-ink-2")} aria-hidden />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function CoachCard() {
  return (
    <div className="rounded-xl border border-line bg-surface p-3">
      <div className="flex items-center gap-2.5">
        <div className="flex size-8 items-center justify-center rounded-full bg-accent-soft text-[13px] font-semibold text-accent">AV</div>
        <div className="min-w-0 leading-tight">
          <div className="truncate text-[13px] font-semibold">{COACH.name}</div>
          <div className="truncate text-[11px] text-ink-3">{COACH.brand}</div>
        </div>
      </div>
    </div>
  );
}

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const dark = mounted && resolvedTheme === "dark";
  return (
    <Tip content={dark ? "Switch to light theme" : "Switch to dark theme"}>
      <Button variant="ghost" size="icon" aria-label="Toggle theme" onClick={() => setTheme(dark ? "light" : "dark")}>
        {dark ? <Sun /> : <Moon />}
      </Button>
    </Tip>
  );
}

function ClockPill() {
  const now = useNow(15000);
  return (
    <span className="hidden items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1 text-xs text-ink-2 md:inline-flex tnum">
      {formatISTPattern(new Date(now).toISOString(), "EEE d MMM, h:mm a")} IST
    </span>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[248px_1fr]">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[70] focus:rounded-lg focus:bg-ink focus:px-3 focus:py-2 focus:text-surface">
        Skip to content
      </a>

      <aside className="sticky top-0 hidden h-dvh flex-col gap-6 border-r border-line bg-surface-2 px-4 py-5 lg:flex">
        <Logo />
        <div className="scroll-thin flex-1 overflow-y-auto">
          <NavList pathname={pathname} />
        </div>
        <CoachCard />
      </aside>

      <div className="min-w-0">
        <div className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-line bg-page/85 px-4 backdrop-blur-md sm:px-6">
          <RadixDialog.Root open={mobileOpen} onOpenChange={setMobileOpen}>
            <RadixDialog.Trigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu">
                <Menu />
              </Button>
            </RadixDialog.Trigger>
            <RadixDialog.Portal>
              <RadixDialog.Overlay className="anim-overlay fixed inset-0 z-50 bg-black/40" />
              <RadixDialog.Content className="anim-sheet fixed inset-y-0 left-0 z-50 flex w-[280px] flex-col gap-6 border-r border-line bg-surface-2 px-4 py-5 outline-none">
                <RadixDialog.Title className="sr-only">Navigation</RadixDialog.Title>
                <RadixDialog.Description className="sr-only">Main navigation</RadixDialog.Description>
                <div className="flex items-center justify-between">
                  <Logo />
                  <RadixDialog.Close asChild>
                    <Button variant="ghost" size="icon" aria-label="Close menu">
                      <X />
                    </Button>
                  </RadixDialog.Close>
                </div>
                <div className="flex-1 overflow-y-auto">
                  <NavList pathname={pathname} onNavigate={() => setMobileOpen(false)} />
                </div>
                <CoachCard />
              </RadixDialog.Content>
            </RadixDialog.Portal>
          </RadixDialog.Root>

          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-lg border border-line bg-surface px-3 text-left text-[13px] text-ink-3 transition-colors hover:border-axis sm:max-w-md"
          >
            <Search className="size-4 shrink-0" aria-hidden />
            <span className="min-w-0 flex-1 truncate">Search webinars, people, ads…</span>
            <kbd className="hidden rounded border border-line bg-surface-2 px-1.5 py-0.5 text-[11px] font-medium text-ink-3 sm:inline">⌘K</kbd>
          </button>

          <div className="ml-auto flex items-center gap-2">
            <ClockPill />
            <Tip content="Everything on screen is seeded sample data. Changes you make live in memory until you reload.">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent-soft px-2.5 py-1 text-xs font-medium text-accent">
                <Database className="size-3" aria-hidden />
                <span className="hidden sm:inline">Sample data</span>
                <span className="sm:hidden">Sample</span>
              </span>
            </Tip>
            <ThemeToggle />
          </div>
        </div>

        <main id="main" className="mx-auto w-full max-w-[1280px] px-4 py-6 sm:px-6 sm:py-8">
          {children}
        </main>
      </div>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </div>
  );
}
