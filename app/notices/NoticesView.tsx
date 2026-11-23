"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import { BOARDS, CAFE, latestIds, type BoardKey, type CafePost } from "@/lib/cafeNotices";
import { markSeen } from "@/lib/noticeSeen";
import "./notices.css";

const KEYS = Object.keys(BOARDS) as BoardKey[];

function dateText(date: string | null, today: string) {
  if (!date) return "";
  const [y, m, d] = date.split("-");
  return y === today.slice(0, 4) ? `${Number(m)}.${Number(d)}` : `${y}.${Number(m)}.${Number(d)}`;
}

export function NoticesView({ boards, today }: { boards: Record<BoardKey, CafePost[] | null>; today: string }) {
  const [tab, setTab] = useState<BoardKey>("notice");
  const posts = boards[tab];

  useEffect(() => markSeen(latestIds(boards)), [boards]);

  return (
    <div className="stack">
      <div className="seg" role="group" aria-label="게시판">
        {KEYS.map((k) => (
          <button key={k} type="button" aria-pressed={tab === k} onClick={() => setTab(k)}>
            {BOARDS[k].label}
          </button>
        ))}
      </div>

      {posts === null ? (
        <p className="panel glass empty">
          카페 목록을 불러오지 못했습니다.{" "}
          <a href={`https://m.cafe.daum.net/${CAFE}/${BOARDS[tab].fldid}`} target="_blank" rel="noopener noreferrer">
            카페에서 보기
          </a>
        </p>
      ) : posts.length === 0 ? (
        <p className="panel glass empty">글이 없습니다.</p>
      ) : (
        <ul className="nt-list panel glass">
          {posts.map((p) => (
            <li key={p.dataid}>
              <a href={p.url} target="_blank" rel="noopener noreferrer" className={p.pinned ? "pinned" : undefined}>
                <span className="nt-title">
                  {p.pinned && <span className="tag nt-pin">고정</span>}
                  {p.head && p.head !== "공지사항" && <span className="tag">{p.head}</span>}
                  <span className="nt-text">{p.title}</span>
                  {p.comments > 0 && <span className="nt-cmt">[{p.comments}]</span>}
                </span>
                <span className="nt-date">{dateText(p.date, today)}</span>
                <Icon name="external" label="새 창" />
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
