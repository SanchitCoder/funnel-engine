"use client";

import { Command } from "cmdk";
import { Banknote, Layers, LayoutDashboard, Megaphone, Settings2, Target, TrendingUp, User, UserSearch, Video } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { usePersonDrawer } from "@/components/person-drawer";
import { useSearch } from "@/lib/hooks";
import { formatISTShort } from "@/lib/format";

const PAGES = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/webinars", label: "Webinars", icon: Video },
  { href: "/segments", label: "Segments & follow-ups", icon: Layers },
  { href: "/trends", label: "Trends", icon: TrendingUp },
  { href: "/attribution", label: "Attribution", icon: Target },
  { href: "/people", label: "People", icon: UserSearch },
  { href: "/sales", label: "Sales & calls", icon: Banknote },
  { href: "/system", label: "System", icon: Settings2 },
];

export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const router = useRouter();
  const { openPerson } = usePersonDrawer();
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 120);
    return () => clearTimeout(t);
  }, [query]);
  useEffect(() => {
    if (!open) {
      setQuery("");
      setDebounced("");
    }
  }, [open]);

  const { data } = useSearch(debounced);
  const go = (href: string) => {
    onOpenChange(false);
    router.push(href);
  };
  const pages = PAGES.filter((p) => !query || p.label.toLowerCase().includes(query.toLowerCase()));

  return (
    <Command.Dialog
      open={open}
      onOpenChange={onOpenChange}
      label="Search"
      shouldFilter={false}
      className="fixed left-1/2 top-[14vh] z-[80] w-[calc(100vw-24px)] max-w-xl -translate-x-1/2 overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl"
      overlayClassName="fixed inset-0 z-[79] bg-black/40 backdrop-blur-[2px]"
    >
      <Command.Input
        value={query}
        onValueChange={setQuery}
        placeholder="Search webinars, people, ads, or jump to a page…"
        className="h-12 w-full border-b border-line bg-transparent px-4 text-sm outline-none placeholder:text-ink-3"
      />
      <Command.List className="scroll-thin max-h-[56vh] overflow-y-auto p-2">
        <Command.Empty className="px-3 py-8 text-center text-sm text-ink-3">No results. Try a name, email, topic or ad.</Command.Empty>

        {pages.length > 0 ? (
          <Group heading="Pages">
            {pages.map((p) => (
              <Item key={p.href} value={`page-${p.href}`} onSelect={() => go(p.href)} icon={<p.icon className="size-4" />}>
                {p.label}
              </Item>
            ))}
          </Group>
        ) : null}

        {data?.webinars.length ? (
          <Group heading="Webinars">
            {data.webinars.map((w) => (
              <Item key={w.id} value={`w-${w.id}`} onSelect={() => go(`/webinars/${w.id}`)} icon={<Video className="size-4" />} meta={`${formatISTShort(w.scheduled_at)} · ${w.status}`}>
                {w.title}
              </Item>
            ))}
          </Group>
        ) : null}

        {data?.people.length ? (
          <Group heading="People">
            {data.people.map((p) => (
              <Item
                key={p.registrant_id}
                value={`p-${p.registrant_id}`}
                onSelect={() => {
                  onOpenChange(false);
                  openPerson(p.registrant_id);
                }}
                icon={<User className="size-4" />}
                meta={p.email}
              >
                {p.name}
              </Item>
            ))}
          </Group>
        ) : null}

        {data?.ads.length ? (
          <Group heading="Ads">
            {data.ads.map((a) => (
              <Item key={a.ad_id} value={`a-${a.ad_id}`} onSelect={() => go(`/attribution?ad=${a.ad_id}`)} icon={<Megaphone className="size-4" />} meta={a.adset_name}>
                {a.name}
              </Item>
            ))}
          </Group>
        ) : null}
      </Command.List>
      <div className="flex items-center justify-between border-t border-line px-4 py-2 text-[11px] text-ink-3">
        <span>↑↓ to move · ↵ to open</span>
        <span>Esc to close</span>
      </div>
    </Command.Dialog>
  );
}

function Group({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <Command.Group heading={heading} className="[&_[cmdk-group-heading]]:eyebrow [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pb-1.5 [&_[cmdk-group-heading]]:pt-3">
      {children}
    </Command.Group>
  );
}

function Item({ children, icon, meta, value, onSelect }: { children: React.ReactNode; icon: React.ReactNode; meta?: string; value: string; onSelect: () => void }) {
  return (
    <Command.Item
      value={value}
      onSelect={onSelect}
      className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm text-ink-2 data-[selected=true]:bg-surface-3 data-[selected=true]:text-ink"
    >
      <span className="text-ink-3">{icon}</span>
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {meta ? <span className="hidden max-w-[40%] truncate text-xs text-ink-3 sm:inline">{meta}</span> : null}
    </Command.Item>
  );
}
