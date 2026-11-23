"use client";

import Link from "next/link";
import Image from "next/image";
import horseshoe from "@/app/icon.png";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon, type IconName } from "./Icon";
import { SearchModal } from "./SearchModal";
import "./Sidebar.css";

type Item = { href: string; label: string; icon: IconName; external?: boolean };

const GROUPS: { title: string | null; items: Item[] }[] = [
  { title: null, items: [{ href: "/", label: "홈", icon: "home" }] },
  {
    title: "게임 정보",
    items: [
      { href: "/futures", label: "미래시", icon: "calendar" },
      { href: "/events", label: "이벤트", icon: "flag" },
      { href: "/characters", label: "캐릭터", icon: "person" },
      { href: "/birthdays", label: "생일달력", icon: "cake" },
    ],
  },
  {
    title: "플래너·계산기",
    items: [
      { href: "/calculator", label: "사료계산기", icon: "calc" },
      { href: "/simulator", label: "뽑기 시뮬레이터", icon: "cards" },
    ],
  },
  {
    title: "놀거리",
    items: [{ href: "https://syuenasset.xyz/", label: "슈엔증권", icon: "chart", external: true }],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <>
      <header className="topbar glass">
        <button type="button" className="icon-btn" onClick={() => setOpen(true)} aria-label="메뉴 열기">
          <Icon name="menu" />
        </button>
        <Link href="/" className="logo">
          <Image src={horseshoe} alt="" width={36} height={36} className="logo-mark" />
          <span>우마노트</span>
        </Link>
        <button type="button" className="icon-btn" onClick={() => setSearchOpen(true)} aria-label="검색">
          <Icon name="search" />
        </button>
      </header>

      {open && <div className="nav-scrim" onClick={() => setOpen(false)} aria-hidden />}

      <nav className={`side-nav${open ? " open" : ""}`} aria-label="주 메뉴">
        <div className="nav-head">
          <Link href="/" className="logo">
            <Image src={horseshoe} alt="" width={36} height={36} className="logo-mark" />
            <span>우마노트</span>
          </Link>
          <button type="button" className="icon-btn nav-close" onClick={() => setOpen(false)} aria-label="메뉴 닫기">
            <Icon name="close" />
          </button>
        </div>
        <button type="button" className="search-btn" onClick={() => setSearchOpen(true)}>
          <Icon name="search" />
          검색
          <kbd>Ctrl K</kbd>
        </button>
        {GROUPS.map((g) => {
          const hidden = g.title ? collapsed[g.title] : false;
          return (
            <div key={g.title ?? "root"} className="nav-group">
              {g.title && (
                <button
                  type="button"
                  className="nav-title"
                  aria-expanded={!hidden}
                  onClick={() => setCollapsed((c) => ({ ...c, [g.title as string]: !hidden }))}
                >
                  {g.title}
                  <span className={hidden ? "rot" : ""}>
                    <Icon name="chevronDown" />
                  </span>
                </button>
              )}
              {!hidden &&
                g.items.map((it) =>
                  it.external ? (
                    <a key={it.href} href={it.href} className="nav-link" target="_blank" rel="noopener noreferrer">
                      <Icon name={it.icon} />
                      {it.label}
                      <span className="nav-ext">
                        <Icon name="external" label="새 창" />
                      </span>
                    </a>
                  ) : (
                    <Link key={it.href} href={it.href} className="nav-link" aria-current={isActive(it.href) ? "page" : undefined}>
                      <Icon name={it.icon} />
                      {it.label}
                    </Link>
                  ),
                )}
            </div>
          );
        })}
      </nav>

      <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}
