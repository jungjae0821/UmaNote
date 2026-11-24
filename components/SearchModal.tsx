"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { SEARCH_GROUPS, searchItems, type SearchItem } from "@/lib/search";
import { Icon } from "./Icon";
import { SupportTypeIcon } from "./SupportTypeIcon";
import "./SearchModal.css";

let cache: SearchItem[] | null = null;

export function SearchModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [items, setItems] = useState<SearchItem[] | null>(cache);
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    if (open && !d.open) {
      d.showModal();
      setQuery("");
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    } else if (!open && d.open) d.close();
  }, [open]);

  useEffect(() => {
    if (!open || items) return;
    // 실패했으면 다시 열 때 새로 불러온다. 그동안은 '불러오는 중'을 보인다
    setFailed(false);
    fetch("/api/search")
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((data: unknown) => {
        if (!Array.isArray(data)) throw Error("search list");
        cache = data as SearchItem[];
        setItems(cache);
      })
      .catch(() => setFailed(true));
  }, [open, items]);

  const results = useMemo(() => (items ? searchItems(items, query) : []), [items, query]);

  useEffect(() => setActive(0), [query]);

  const go = (it: SearchItem) => {
    onClose();
    router.push(it.href);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter" && results[active]) {
      e.preventDefault();
      go(results[active]);
    }
  };

  let index = -1;

  return (
    <dialog
      ref={dialogRef}
      className="search-dialog glass"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === dialogRef.current) onClose();
      }}
      aria-label="검색"
    >
      <div className="search-box">
        <Icon name="search" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="캐릭터, 서포트 카드, 픽업, 이벤트 이름"
          aria-label="검색어"
          role="combobox"
          aria-expanded={results.length > 0}
          aria-controls="search-results"
          aria-activedescendant={results[active] ? `sr-${active}` : undefined}
        />
        <button type="button" className="icon-btn" onClick={onClose} aria-label="검색 닫기">
          <Icon name="close" />
        </button>
      </div>
      <div className="search-results" id="search-results" role="listbox">
        {failed && <p className="empty">검색 목록을 불러오지 못했습니다. 잠시 뒤 다시 열어 주세요.</p>}
        {!failed && !items && <p className="empty">검색 목록을 불러오는 중</p>}
        {items && query && results.length === 0 && <p className="empty">&lsquo;{query}&rsquo;와 맞는 이름이 없습니다.</p>}
        {SEARCH_GROUPS.map((g) => {
          const rows = results.filter((r) => r.group === g);
          if (rows.length === 0) return null;
          return (
            <section key={g}>
              <h3>{g}</h3>
              {rows.map((r) => {
                index += 1;
                const i = index;
                return (
                  <button
                    key={r.href + r.title}
                    id={`sr-${i}`}
                    type="button"
                    role="option"
                    aria-selected={i === active}
                    className="sr-row"
                    onMouseEnter={() => setActive(i)}
                    onClick={() => go(r)}
                  >
                    {r.img ? <img src={r.img} alt="" loading="lazy" /> : <span className="sr-dot" />}
                    <span>
                      <b>
                        <SupportTypeIcon type={r.supportType} />
                        {r.title}
                      </b>
                      <small>{r.sub}</small>
                    </span>
                  </button>
                );
              })}
            </section>
          );
        })}
      </div>
    </dialog>
  );
}
