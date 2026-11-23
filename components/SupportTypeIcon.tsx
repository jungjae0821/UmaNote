import { supportTypeArt } from "@/lib/art";
import type { SupportType } from "@/lib/gametora";

export const SUPPORT_TYPE_LABEL: Record<SupportType, string> = {
  speed: "스피드",
  stamina: "스태미나",
  power: "파워",
  guts: "근성",
  intelligence: "지능",
  friend: "우정",
  group: "그룹",
};

/** 서포트 카드 이름 앞에 붙이는 게임 내 타입 아이콘.
 *  주변의 `… img` 선택자에 걸리지 않게 img 대신 배경 그림으로 그린다 */
export function SupportTypeIcon({ type }: { type?: SupportType }) {
  if (!type) return null;
  const label = SUPPORT_TYPE_LABEL[type];
  return <span className="stype" role="img" aria-label={label} title={label} style={{ backgroundImage: `url(${supportTypeArt(type)})` }} />;
}
