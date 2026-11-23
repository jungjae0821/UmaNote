import { latestIds } from "@/lib/cafeNotices";
import { getBoards } from "@/lib/cafeNotices.server";

export const revalidate = 900;

/** 게시판별 가장 큰 글 번호. 사이드바가 NEW! 표시를 정할 때 쓴다 */
export async function GET() {
  return Response.json(latestIds(await getBoards()));
}
