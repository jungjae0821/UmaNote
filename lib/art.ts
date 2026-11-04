import type { Lane } from "./umapyoi";

// umapyoi에는 의상·카드별 이미지가 없어서 gametora의 ID 기반 경로를 쓴다
export const GAMETORA_IMG = "https://gametora.com/images/umamusume";

/** 육성은 의상 ID와 캐릭터 ID, 서포트는 카드 ID만으로 일러스트 주소가 정해진다 */
export function cardArtUrl(lane: Lane, id: number, charaId?: number): string | null {
  if (lane === "support") return `${GAMETORA_IMG}/supports/tex_support_card_${id}.png`;
  return charaId ? `${GAMETORA_IMG}/characters/thumb/chara_stand_${charaId}_${id}.png` : null;
}

export const gachaBannerUrl = (bannerId: number) => `${GAMETORA_IMG}/gacha/img_bnr_gacha_${bannerId}.png`;
