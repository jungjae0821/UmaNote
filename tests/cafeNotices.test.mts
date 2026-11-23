import assert from "node:assert/strict";
import { test } from "node:test";
import { boardPosts, cafeDate, hasUnseen, latestIds, mergeSeen, parseBoard } from "../lib/cafeNotices.ts";

const html = `
<ul>
<li class="cmt_on notice ">
  <a href="/umamusume-kor/Z4os/799?" class="link_cafe">
    <span class="txt_detail">(수정) 11월 스케줄 &amp; 안내</span>
    <span class="created_at">26.10.29</span>
  </a>
  <a href="/umamusume-kor/Z4os/799/comments?" class="link_cmt"><span class="num_cmt">3</span></a>
</li>
<li class="notice ">
  <a href="/umamusume-kor/ZBhu/231?" class="link_cafe">
    <span class="txt_detail">11월 19일(목) 업데이트 안내</span>
    <span class="created_at">26.11.17</span>
  </a>
</li>
</ul>
<script>
  var articles = [];
  articles.push({
    dataid: 231,
    fldid: "ZBhu",
    title: "11월 19일(목) 업데이트 안내",
    commentCount: Number("0"),
    articleElapsedTime: "26.11.17",
    headCont: "",
  });
  articles.push({
    dataid: 230,
    fldid: "ZBhu",
    title: "\\"따옴표\\" 들어간 제목",
    commentCount: Number("5"),
    articleElapsedTime: "09:41",
    headCont: "공지사항",
  });
</script>`;

test("고정 공지와 일반 목록을 모두 읽는다", () => {
  const posts = parseBoard(html, "2026-11-24");
  assert.equal(posts.length, 4);
  assert.deepEqual(posts[0], {
    fldid: "Z4os", dataid: 799, title: "(수정) 11월 스케줄 & 안내", date: "2026-10-29", head: "", comments: 3, pinned: true,
    url: "https://m.cafe.daum.net/umamusume-kor/Z4os/799",
  });
  assert.equal(posts[3].title, '"따옴표" 들어간 제목');
  assert.equal(posts[3].date, "2026-11-24");
  assert.equal(posts[3].comments, 5);
  assert.equal(posts[3].head, "공지사항");
});

test("다른 게시판 고정 공지는 빼고, 중복 글은 하나만 남긴다", () => {
  const posts = boardPosts(parseBoard(html, "2026-11-24"), "ZBhu");
  assert.deepEqual(posts.map((p) => [p.dataid, p.pinned]), [[231, true], [230, false]]);
});

test("날짜 표기를 해석한다", () => {
  assert.equal(cafeDate("26.01.05", "2026-11-24"), "2026-01-05");
  assert.equal(cafeDate("7:05", "2026-11-24"), "2026-11-24");
  assert.equal(cafeDate("어제", "2026-11-24"), null);
});

test("구조가 바뀌어 아무것도 없으면 빈 목록", () => {
  assert.deepEqual(parseBoard("<html></html>", "2026-11-24"), []);
});

test("NEW! 판정: 본 번호보다 큰 글이 있을 때만", () => {
  const posts = parseBoard(html, "2026-11-24");
  const latest = latestIds({ notice: boardPosts(posts, "Z4os"), update: null });
  assert.deepEqual(latest, { Z4os: 799 });
  assert.equal(hasUnseen(latest, {}), true);
  assert.equal(hasUnseen(latest, { Z4os: 799 }), false);
  assert.equal(hasUnseen({ Z4os: 800 }, { Z4os: 799 }), true);
  // 글이 지워져 최신 번호가 내려가도 기록은 유지
  assert.deepEqual(mergeSeen({ Z4os: 810, ZBhu: 5 }, { Z4os: 799 }), { Z4os: 810, ZBhu: 5 });
  assert.equal(hasUnseen({ Z4os: 799 }, { Z4os: 810 }), false);
});
