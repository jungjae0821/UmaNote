import type { Skill } from "@/lib/cardDetail";
import "./SkillCard.css";

/** 스킬 하나: 아이콘, 이름, 설명. 바탕색으로 등급을 나눈다 */
export function SkillCard({ s, tag, evolved }: { s: Skill; tag?: string; evolved?: boolean }) {
  const tone = evolved ? "sk-evo" : s.rarity >= 3 ? "sk-unique" : s.rarity === 2 ? "sk-gold" : "";
  return (
    <div className={`sk ${tone}`}>
      {s.icon ? <img src={s.icon} alt="" width={36} height={36} loading="lazy" /> : <span className="sk-noicon" aria-hidden />}
      <div className="sk-main">
        <p className="sk-name">
          {tag && <span className="tag">{tag}</span>}
          <b lang={s.untranslated ? "ja" : undefined}>{s.name}</b>
        </p>
        {s.desc && (
          <p className="sk-desc" lang={s.untranslated ? "ja" : undefined}>
            {s.desc}
          </p>
        )}
      </div>
    </div>
  );
}
