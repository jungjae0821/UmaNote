"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon, type IconName } from "./Icon";
import { SearchModal } from "./SearchModal";
import "./Sidebar.css";

type Item = { href: string; label: string; icon: IconName };

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
];

const THEME_KEY = "umanote:theme:v1";

export function Sidebar({ eventLive }: { eventLive: boolean }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setTheme(document.documentElement.dataset.theme === "light" ? "light" : "dark");
  }, []);

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

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    setTheme(next);
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      // 저장소를 못 쓰면 이번 방문 동안만 바뀐다
    }
  };

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <>
      <header className="topbar glass">
        <button type="button" className="icon-btn" onClick={() => setOpen(true)} aria-label="메뉴 열기">
          <Icon name="menu" />
        </button>
        <Link href="/" className="logo">
          우마노트
        </Link>
        <button type="button" className="icon-btn" onClick={() => setSearchOpen(true)} aria-label="검색">
          <Icon name="search" />
        </button>
      </header>

      {open && <div className="nav-scrim" onClick={() => setOpen(false)} aria-hidden />}

      <nav className={`side-nav${open ? " open" : ""}`} aria-label="주 메뉴">
        <div className="nav-head">
          <Link href="/" className="logo">
            우마노트
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
                g.items.map((it) => (
                  <Link key={it.href} href={it.href} className="nav-link" aria-current={isActive(it.href) ? "page" : undefined}>
                    <Icon name={it.icon} />
                    {it.label}
                    {it.href === "/events" && eventLive && <span className="nav-note">진행중</span>}
                  </Link>
                ))}
            </div>
          );
        })}
        <div className="nav-foot">
          <button type="button" className="icon-btn" onClick={toggleTheme} aria-label={theme === "dark" ? "라이트 테마로" : "다크 테마로"}>
            <Icon name={theme === "dark" ? "sun" : "moon"} />
          </button>
        </div>
      </nav>

      <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}
