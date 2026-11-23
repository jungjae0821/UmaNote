// 일러스트는 gametora의 ID 기반 경로를 쓴다.
export const GAMETORA_IMG = "https://gametora.com/images/umamusume";

/** 육성 의상 일러스트. umapyoi 의상 목록과 같은 512px 원본 경로를 쓴다. */
export const outfitArt = (charId: number, cardId: number) =>
  `${GAMETORA_IMG}/characters/chara_stand_${charId}_${cardId}.png`;

/** 서포트 카드 일러스트. 한국서버에 아직 없는 카드는 큰 그림이 없어서 작은 카드 그림을 쓴다 */
export const supportArt = (supportId: number, releasedKr = true) =>
  releasedKr ? `${GAMETORA_IMG}/supports/tex_support_card_${supportId}.png` : `${GAMETORA_IMG}/supports/support_card_s_${supportId}.png`;

/** 캐릭터 얼굴 아이콘 */
export const charIcon = (charId: number) => `${GAMETORA_IMG}/characters/icons/chr_icon_${charId}.png`;

/** 한국서버 게임 내 가챠 배너 */
export const bannerArt = (bannerId: number) => `${GAMETORA_IMG}/ko/gacha/img_bnr_gacha_${bannerId}.png`;

// 나무위키 스토리 이벤트/4~6년차의 해당 이벤트 항목에서 가져온 한국어 배너.
// 출처: https://namu.wiki/w/우마무스메%20프리티%20더비/이벤트/스토리%20이벤트/4~6년차#s-2.13
const STORY_EVENT_BANNERS: Record<number, string> = {
  1046: "/images/events/story-1046.webp",
};

/** 이벤트별로 확인한 한국어 배너가 있으면 우선 사용한다. */
export const storyEventArt = (eventId: number) =>
  STORY_EVENT_BANNERS[eventId] ?? `https://media.gametora.com/umamusume/story_events/hero/${eventId}.png`;
