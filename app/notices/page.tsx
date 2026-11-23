import type { Metadata } from "next";
import { CAFE } from "@/lib/cafeNotices";
import { getBoards, todayIso } from "@/lib/cafeNotices.server";
import { NoticesView } from "./NoticesView";

export const metadata: Metadata = { title: "공지사항" };
export const revalidate = 900;

export default async function NoticesPage() {
  const boards = await getBoards();
  return (
    <>
      <div className="page-head">
        <h1>공지사항</h1>
        <a className="aside-link" href={`https://m.cafe.daum.net/${CAFE}`} target="_blank" rel="noopener noreferrer">
          공식 카페
        </a>
      </div>
      <NoticesView boards={boards} today={todayIso()} />
    </>
  );
}
