/** 우마무스메 공식 다음 카페(umamusume-kor) 게시판 목록을 모바일 페이지 소스에서 읽는다.
 * 공식 API가 없어서, 페이지에 박힌 articles.push({...})와 고정 공지 HTML을 파싱한다 */

export const CAFE = "umamusume-kor";
export const BOARDS = {
  notice: { fldid: "Z4os", label: "공지" },
  update: { fldid: "ZBhu", label: "업데이트" },
} as const;
export type BoardKey = keyof typeof BOARDS;

export type CafePost = {
  fldid: string;
  dataid: number;
  title: string;
  /** "YYYY-MM-DD", 알 수 없으면 null */
  date: string | null;
  head: string;
  comments: number;
  pinned: boolean;
  url: string;
};

export const postUrl = (fldid: string, dataid: number) => `https://m.cafe.daum.net/${CAFE}/${fldid}/${dataid}`;

const decode = (s: string) =>
  s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").trim();

/** JS 문자열 리터럴 본문을 푼다. JSON과 다른 이스케이프가 섞이면 원문을 쓴다 */
function jsString(raw: string) {
  try {
    return JSON.parse(`"${raw}"`) as string;
  } catch {
    return raw.replace(/\\(.)/g, "$1");
  }
}

/** "26.11.19"는 그날, "14:22"처럼 시각만 오면 오늘 올라온 글이다 */
export function cafeDate(text: string, today: string): string | null {
  const ymd = text.match(/^(\d{2})\.(\d{2})\.(\d{2})$/);
  if (ymd) return `20${ymd[1]}-${ymd[2]}-${ymd[3]}`;
  if (/^\d{1,2}:\d{2}$/.test(text)) return today;
  return null;
}

export function parseBoard(html: string, today: string): CafePost[] {
  const posts: CafePost[] = [];

  for (const li of html.matchAll(/<li class="[^"]*\bnotice\b[^"]*">([\s\S]*?)<\/li>/g)) {
    const link = li[1].match(new RegExp(`href="/${CAFE}/([A-Za-z0-9]+)/(\\d+)\\?"\\s+class="link_cafe"`));
    const title = li[1].match(/class="txt_detail">([^<]*)</);
    if (!link || !title) continue;
    const date = li[1].match(/class="created_at">([^<]*)</)?.[1].trim() ?? "";
    const comments = li[1].match(/class="num_cmt">(\d+)</)?.[1];
    posts.push({
      fldid: link[1],
      dataid: Number(link[2]),
      title: decode(title[1]),
      date: cafeDate(date, today),
      head: "",
      comments: Number(comments ?? 0),
      pinned: true,
      url: postUrl(link[1], Number(link[2])),
    });
  }

  for (const block of html.matchAll(/articles\.push\(\{([\s\S]*?)\}\);/g)) {
    const body = block[1];
    const str = (key: string) => {
      const m = body.match(new RegExp(`\\b${key}:\\s*"((?:[^"\\\\]|\\\\.)*)"`));
      return m ? jsString(m[1]) : "";
    };
    const dataid = Number(body.match(/\bdataid:\s*(\d+)/)?.[1]);
    const fldid = str("fldid");
    const title = str("title");
    if (!Number.isInteger(dataid) || !fldid || !title) continue;
    posts.push({
      fldid,
      dataid,
      title: decode(title),
      date: cafeDate(str("articleElapsedTime"), today),
      head: decode(str("headCont")),
      comments: Number(body.match(/\bcommentCount:\s*Number\("(\d+)"\)/)?.[1] ?? 0),
      pinned: false,
      url: postUrl(fldid, dataid),
    });
  }

  return posts;
}

/** 이 게시판 글만 남기고, 고정 공지와 일반 목록에 같이 나온 글은 고정 쪽 하나로 합친다 */
export function boardPosts(posts: CafePost[], fldid: string): CafePost[] {
  const seen = new Set<number>();
  const pinned = posts.filter((p) => p.pinned && p.fldid === fldid);
  const rest = posts.filter((p) => !p.pinned && p.fldid === fldid);
  const out: CafePost[] = [];
  for (const p of [...pinned, ...rest]) {
    if (seen.has(p.dataid)) continue;
    seen.add(p.dataid);
    out.push(p);
  }
  return out;
}

/** 게시판별(fldid) 가장 큰 글 번호. 못 읽은 게시판은 빠진다 */
export type LatestIds = Record<string, number>;

export function latestIds(boards: Partial<Record<BoardKey, CafePost[] | null>>): LatestIds {
  const out: LatestIds = {};
  for (const key of Object.keys(boards) as BoardKey[]) {
    const posts = boards[key];
    if (posts?.length) out[BOARDS[key].fldid] = Math.max(...posts.map((p) => p.dataid));
  }
  return out;
}

/** 본 기록보다 큰 글 번호가 하나라도 있으면 안 본 새 글이 있다. 기록이 없으면 전부 새 글 */
export const hasUnseen = (latest: LatestIds, seen: LatestIds) =>
  Object.entries(latest).some(([fldid, id]) => id > (seen[fldid] ?? 0));

/** 기록은 줄어들지 않는다. 글이 지워져 최신 번호가 내려가도 다시 NEW!가 뜨지 않게 */
export function mergeSeen(seen: LatestIds, latest: LatestIds): LatestIds {
  const out = { ...seen };
  for (const [fldid, id] of Object.entries(latest)) out[fldid] = Math.max(out[fldid] ?? 0, id);
  return out;
}
