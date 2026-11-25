import type { Metadata } from "next";
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
      </div>
      <NoticesView boards={boards} today={todayIso()} />
    </>
  );
}
