"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "홈" },
  { href: "/gacha", label: "가챠 일정" },
  { href: "/simulator", label: "뽑기 시뮬레이터" },
  { href: "/calculator", label: "사료계산기" },
  { href: "/birthdays", label: "생일달력" },
  { href: "/events", label: "이벤트 일정" },
];

export function SiteNav() {
  const pathname = usePathname();
  return (
    <header className="site-header">
      <nav className="site-nav" aria-label="주요 메뉴">
        <Link href="/" className="logo">
          <span className="logo-mark" aria-hidden="true" />
          우마노트
        </Link>
        <ul className="nav-links">
          {LINKS.map((l) => (
            <li key={l.href}>
              <Link href={l.href} aria-current={pathname === l.href ? "page" : undefined}>
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}
