// 일러스트는 gametora의 ID 기반 경로를 쓴다.
export const GAMETORA_IMG = "https://gametora.com/images/umamusume";

/** 육성 의상 일러스트. umapyoi 의상 목록과 같은 512px 원본 경로를 쓴다. */
export const outfitArt = (charId: number, cardId: number) =>
  `${GAMETORA_IMG}/characters/chara_stand_${charId}_${cardId}.png`;

/** 서포트 카드 일러스트. 큰 그림이 아직 없는 최신 카드는 작은 카드 그림 (getCards에서 나무위키 이미지로 먼저 대신한다) */
export const supportArt = (supportId: number, releasedKr = true) =>
  releasedKr ? `${GAMETORA_IMG}/supports/tex_support_card_${supportId}.png` : `${GAMETORA_IMG}/supports/support_card_s_${supportId}.png`;

const SUPPORT_TYPE_ICON = { speed: 0, stamina: 1, power: 2, guts: 3, intelligence: 4, friend: 5, group: 6 } as const;

/** 서포트 카드 타입 아이콘 (스피드·스태미나·파워·근성·지능·우정·그룹) */
export const supportTypeArt = (type: keyof typeof SUPPORT_TYPE_ICON) =>
  `${GAMETORA_IMG}/icons/utx_ico_obtain_0${SUPPORT_TYPE_ICON[type]}.png`;

/** 능력치 아이콘 (스피드·스태미나·파워·근성·지능). 서포트 타입 아이콘과 같은 그림이다 */
export const statArt = (i: number) => `${GAMETORA_IMG}/icons/utx_ico_obtain_0${i}.png`;

/** 게임 내 스킬 아이콘 */
export const skillArt = (iconId: number) => `${GAMETORA_IMG}/skill_icons/utx_ico_skill_${iconId}.png`;

/** 캐릭터 얼굴 아이콘 */
export const charIcon = (charId: number) => `${GAMETORA_IMG}/characters/icons/chr_icon_${charId}.png`;

/** 한국서버 게임 내 가챠 배너 */
export const bannerArt = (bannerId: number) => `${GAMETORA_IMG}/ko/gacha/img_bnr_gacha_${bannerId}.png`;

/** 홍보 문구가 없는 스토리 이벤트 일러스트. 이벤트 ID로 해당 그림을 불러온다. */
export const storyEventArt = (eventId: number) =>
  `https://media.gametora.com/umamusume/story_events/hero/${eventId}.png`;
