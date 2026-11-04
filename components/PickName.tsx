import type { Pickup } from "@/lib/umapyoi";

/** 픽업 카드 이름 줄: 이름, 레어도, 서포트 타입 아이콘 */
export function PickName({ pickup: p }: { pickup: Pickup }) {
  return (
    <b>
      {p.name}
      {p.rarity && <span className="pick-rarity">{p.rarity}</span>}
      {p.supportType && (
        <img
          className="pick-type"
          src={p.supportType.icon}
          alt={`${p.supportType.label} 타입`}
          title={`${p.supportType.label} 타입`}
          width={18}
          height={18}
        />
      )}
    </b>
  );
}
