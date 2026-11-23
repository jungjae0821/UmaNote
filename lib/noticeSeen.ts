import { mergeSeen, type LatestIds } from "./cafeNotices";

const KEY = "umanote.notices.seen";
export const SEEN_EVENT = "umanote:notices-seen";

export function readSeen(): LatestIds {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "null") as unknown;
    return v && typeof v === "object" ? (v as LatestIds) : {};
  } catch {
    return {};
  }
}

/** 공지사항 페이지에서 본 글 번호를 남기고, 사이드바에 알린다 */
export function markSeen(latest: LatestIds) {
  try {
    localStorage.setItem(KEY, JSON.stringify(mergeSeen(readSeen(), latest)));
  } catch {
    // 저장소를 못 쓰면 표시만 남는다
  }
  window.dispatchEvent(new Event(SEEN_EVENT));
}
