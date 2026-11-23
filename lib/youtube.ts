import "server-only";
import { logFailure } from "./fetchJson";

/** 일본 우마무스메 공식 채널 (ぱかチューブっ!) */
export const UMA_CHANNEL_URL = "https://www.youtube.com/@UMAMUSUME_official";
const UMA_CHANNEL_ID = "UCAWxPGGuIfWME2KTLUmSCHw";

export type Video = { id: string; title: string; url: string; thumbnail: string; published: number };

const unescape = (s: string) =>
  s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/g, "&");

const tag = (xml: string, name: string) => xml.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`))?.[1];

/** 유튜브 채널 RSS(Atom)에서 최근 영상 목록만 뽑는다. API 키 없이 채널당 최근 15개가 온다 */
export function parseYoutubeFeed(xml: string): Video[] {
  const videos: Video[] = [];
  for (const [, entry] of xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)) {
    const id = tag(entry, "yt:videoId");
    const title = tag(entry, "title");
    const published = Date.parse(tag(entry, "published") ?? "");
    if (!id || !title || !Number.isFinite(published)) continue;
    const link = entry.match(/<link rel="alternate" href="([^"]+)"/)?.[1];
    videos.push({
      id,
      title: unescape(title),
      url: link ? unescape(link) : `https://www.youtube.com/watch?v=${id}`,
      thumbnail: entry.match(/<media:thumbnail url="([^"]+)"/)?.[1] ?? `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
      published: Math.floor(published / 1000),
    });
  }
  return videos.sort((a, b) => b.published - a.published);
}

/** 공식 채널 최근 영상. 실패하면 빈 목록을 돌려주고 홈은 그대로 그린다 */
export async function getUmaVideos(limit = 4): Promise<Video[]> {
  try {
    const res = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${UMA_CHANNEL_ID}`, {
      next: { revalidate: 1800 },
    });
    if (!res.ok) throw new Error(`youtube feed ${res.status}`);
    return parseYoutubeFeed(await res.text()).slice(0, limit);
  } catch (err) {
    logFailure("유튜브 공식 채널", err);
    return [];
  }
}
