// 한국서버 미출시라 gametora에 한국어가 없는 이름·카드 제목·스킬을 나무위키 표기로 채운다.
// 데이터는 lib/data/namuKo.json (나무위키 각 캐릭터 '인게임 정보' 문서에서 모은 것)
import data from "./data/namuKo.json";

const names = data.names as Record<string, string>;
const skills = data.skills as unknown as Record<string, [string, string]>;
const cards = new Map((data.cards as unknown as [string, string, string, string][]).map(([name, kind, jpDate, title]) => [`${name}|${kind}|${jpDate}`, title]));

/** gametora의 ○와 나무위키의 ◯처럼 모양만 다른 글자를 맞춘다 */
const norm = (s: string) => s.normalize("NFKC").replace(/[◯〇]/g, "○").replace(/\s/g, "");
const skillsByNorm = new Map(Object.entries(skills).map(([jp, v]) => [norm(jp), v]));

/** 히라가나·가타카나 (가운뎃점 ・ 은 한국어에도 쓰여서 뺀다) */
export const KANA = /[぀-ゟ゠-ヺー]/;
const KANJI = /[一-鿿]/;

/** gametora는 번역이 없을 때 한국어 칸에 일본어 원문을 넣어 두기도 한다. 그런 값이면 undefined.
 *  영어 이름은 원래 두 언어가 같아서 그대로 둔다 */
export function realKo(ko: string | undefined, jp: string | undefined): string | undefined {
  if (!ko) return undefined;
  return KANA.test(ko) || (ko === jp && KANJI.test(ko)) ? undefined : ko;
}

/** 일본어 캐릭터 이름 → 나무위키 표제어 */
export const namuCharName = (jpName?: string) => (jpName ? names[jpName] : undefined);

/** 카드 제목. kind는 육성 "t", 서포트는 "R"·"SR"·"SSR". jpDate는 일본서버 출시일(YYYY-MM-DD) */
export const namuCardTitle = (koName: string, kind: string, jpTitle?: string, jpDate?: string) =>
  jpTitle === "[トレセン学園]" ? "트레센 학원" : jpDate ? cards.get(`${koName}|${kind}|${jpDate}`) : undefined;

/** 큰 일러스트가 아직 없는 서포트 카드의 나무위키 카드 이미지 (200×266) */
export const namuSupportArt = (supportId: number) => (data.supportArt as Record<string, string>)[supportId];

/** 일본어 스킬 이름 → [한국어 이름, 설명] */
export const namuSkill = (jpName: string) => skills[jpName] ?? skillsByNorm.get(norm(jpName));
