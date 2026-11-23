import "server-only";
import { BOARDS, CAFE, boardPosts, parseBoard, type BoardKey, type CafePost } from "./cafeNotices";
import { logFailure } from "./fetchJson";

export const NOTICES_REVALIDATE = 900;

export const todayIso = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);

/** 실패하거나 구조가 바뀌어 글을 하나도 못 읽으면 null */
export async function getBoard(key: BoardKey): Promise<CafePost[] | null> {
  const { fldid } = BOARDS[key];
  try {
    const res = await fetch(`https://m.cafe.daum.net/${CAFE}/${fldid}`, { next: { revalidate: NOTICES_REVALIDATE } });
    if (!res.ok) throw new Error(`${res.status}`);
    const posts = boardPosts(parseBoard(await res.text(), todayIso()), fldid);
    if (posts.length === 0) throw new Error("목록을 찾지 못함(페이지 구조 변경?)");
    return posts;
  } catch (err) {
    logFailure(`다음 카페 ${BOARDS[key].label} 게시판`, err);
    return null;
  }
}

export async function getBoards(): Promise<Record<BoardKey, CafePost[] | null>> {
  const [notice, update] = await Promise.all([getBoard("notice"), getBoard("update")]);
  return { notice, update };
}
