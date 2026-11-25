"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

/** 사이트 안 링크를 누르면 다음 페이지가 뜰 때까지 화면 맨 위에 얇은 진행 막대를 보여 준다 */
export function NavProgress() {
  const pathname = usePathname();
  const search = useSearchParams();
  const [busy, setBusy] = useState(false);

  // 주소가 바뀌면 새 페이지가 그려진 것
  useEffect(() => setBusy(false), [pathname, search]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin) return;
      // 같은 페이지 안의 #이동은 새로 불러오지 않는다
      if (url.pathname === location.pathname && url.search === location.search) return;
      setBusy(true);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  // 응답이 끊겨 주소가 끝내 안 바뀌어도 막대가 영영 남지 않게 한다
  useEffect(() => {
    if (!busy) return;
    const t = setTimeout(() => setBusy(false), 15_000);
    return () => clearTimeout(t);
  }, [busy]);

  return <div className={`nav-progress${busy ? " on" : ""}`} aria-hidden />;
}
