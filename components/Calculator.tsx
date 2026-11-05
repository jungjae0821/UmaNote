"use client";

import { useEffect, useMemo, useState } from "react";
import { CardArt } from "@/components/CardArt";
import { PickName } from "@/components/PickName";
import { formatDday, formatFull, formatShort, krToJp, weekday } from "@/lib/dates";
import {
  CEILING,
  DAILY_MISSION_JEWELS,
  JEWELS_PER_PULL,
  MONTHLY,
  plan,
  pullsFor,
  TRAINING_PASS,
  type Income,
  type PassPlan,
} from "@/lib/jewelPlan";
import {
  competitionIncomes,
  giftIncomes,
  LEGEND_RACE_FIRST_WIN,
  legendEditionId,
  LOGIN_BONUS,
  LOH_RANKS,
  lohJewels,
  TEAM_TRIALS_WEEKLY,
  type CmLeague,
  type CmResult,
  type Scheduled,
  type TeamClass,
} from "@/lib/jewelSources";
import { EMPTY_CALC, readCalc, readJewels, writeCalc, writeJewels, type CalcInput } from "@/lib/jewels";
import type { Gacha } from "@/lib/umapyoi";

const num = (n: number) => n.toLocaleString("ko-KR");
/** 쥬얼 수는 늘 "개"를 붙여 보인다 */
const jw = (n: number) => `${num(n)}개`;
/** 뽑기 티켓 수는 늘 "장"을 붙여 보인다 */
const tk = (n: number) => `${num(n)}장`;
const LANE_NAME = { train: "육성", support: "서포트" } as const;

type Form = CalcInput & { paid: number; free: number };

const { standard: PASS_STD, premium: PASS_PRE } = TRAINING_PASS;
const PASS_OPTIONS: { value: PassPlan; label: string; note?: string }[] = [
  { value: "none", label: "넣지 않아요" },
  {
    value: "standard",
    label: "무료 보상만 끝까지 받아요",
    note: `한 달마다 쥬얼 ${jw(PASS_STD.free)}, 육성·서포트 티켓 ${PASS_STD.trainTickets}장씩`,
  },
  {
    value: "premium",
    label: "프리미엄 패스도 사요",
    note: `한 달마다 위 보상에 더해 살 때 유료 ${jw(PASS_PRE.paidOnBuy)}, 쥬얼 ${jw(PASS_PRE.free)}, 육성·서포트 티켓 ${PASS_PRE.trainTickets}장씩`,
  },
];

/** 빈칸·음수·소수는 0 이상의 정수로 */
function toCount(value: string): number {
  const n = Math.floor(Number(value.replace(/[^\d]/g, "")));
  return Number.isFinite(n) ? n : 0;
}

const TEAM_OPTIONS = [
  { value: "0", label: "넣지 않아요" },
  ...[6, 5, 4, 3, 2, 1].map((c) => ({ value: String(c), label: `클래스 ${c} · 매주 ${jw(TEAM_TRIALS_WEEKLY[c])}` })),
];
const CM_LEAGUE_OPTIONS = [
  { value: "grade", label: "그레이드 리그" },
  { value: "open", label: "오픈 리그" },
];
const CM_RESULT_OPTIONS: { value: CmResult; label: string }[] = [
  { value: "none", label: "넣지 않아요" },
  { value: "A1", label: "A결승 1위" },
  { value: "A2", label: "A결승 2위" },
  { value: "A3", label: "A결승 3위" },
  { value: "B1", label: "B결승 1위" },
  { value: "B2", label: "B결승 2위" },
  { value: "B3", label: "B결승 3위" },
  { value: "out", label: "결승 1~3위 밖 (0개)" },
];
const LOH_OPTIONS = [
  { value: "-1", label: "넣지 않아요" },
  ...LOH_RANKS.map((r, i) => ({ value: String(i), label: `${r.name} · 합계 ${jw(lohJewels(i))}` })).reverse(),
];

function SelectField({
  id,
  label,
  value,
  options,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="calc-field">
      <label htmlFor={id}>{label}</label>
      <select id={id} className="bp-select" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

const SOURCE_NAME: Record<Income["source"], string> = {
  story: "스토리 이벤트 포인트·빙고 보상",
  limited: "기간 한정 미션",
  cm: "결승 보상",
  legend: "첫 1착 보상",
  loh: "랭크 도달 보상",
  gift: "운영 선물",
  login: "특별 로그인 보너스 (기간 중 모두 받을 때)",
};

// 고정 목록이라 한 번만 만든다
const GIFT_INCOMES = giftIncomes();

function gachaLabel(g: Gacha): string {
  // 같은 캐릭터 카드가 여럿이거나 복각 모음 배너는 이름이 길어서, 한 번씩만 세 명까지 적는다
  const unique = [...new Set(g.pickups.map((p) => p.name))];
  const names = unique.slice(0, 3).join(", ") + (unique.length > 3 ? ` 외 ${unique.length - 3}명` : "");
  const tag = g.paidOnly ? " (유료 쥬얼 전용)" : "";
  return `${formatFull(g.startKr)} ${LANE_NAME[g.lane]} · ${names}${tag}`;
}

function NumberField({
  id,
  label,
  value,
  unit,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  unit: string;
  onChange: (n: number) => void;
}) {
  return (
    <div className="calc-field">
      <label htmlFor={id}>{label}</label>
      <div className="calc-input">
        <input
          id={id}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          value={value === 0 ? "" : num(value)}
          placeholder="0"
          onChange={(e) => onChange(toCount(e.target.value))}
        />
        <span>{unit}</span>
      </div>
    </div>
  );
}

function Rewards({ i }: { i: Income }) {
  const parts = [
    i.free > 0 && `쥬얼 ${jw(i.free)}`,
    i.trainTickets > 0 && `육성 티켓 ${tk(i.trainTickets)}`,
    i.supportTickets > 0 && `서포트 티켓 ${tk(i.supportTickets)}`,
  ].filter(Boolean);
  return <span className="route-gain">+ {parts.join(", ")}</span>;
}

type Props = { today: number; gachas: Gacha[]; incomes: Income[]; schedule: Scheduled[] };

export function Calculator({ today, gachas, incomes, schedule }: Props) {
  const [form, setForm] = useState<Form>({ ...EMPTY_CALC, paid: 0, free: 0 });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const j = readJewels();
    setForm({ ...readCalc(), paid: j?.paid ?? 0, free: j?.free ?? 0 });
    setLoaded(true);
  }, []);

  // 사용자가 고친 값만 저장한다. 처음 읽어 온 값을 그대로 다시 쓰지 않도록 update 안에서 저장
  function update(patch: Partial<Form>) {
    setForm((prev) => {
      const next = { ...prev, ...patch };
      const { paid, free, ...calc } = next;
      writeJewels({ paid, free });
      writeCalc(calc);
      return next;
    });
  }

  const target = gachas.find((g) => g.id === form.targetId) ?? null;

  const result = useMemo(() => {
    if (!target) return null;
    const p = plan({
      today,
      target: target.startKr,
      paid: form.paid,
      free: form.free,
      trainTickets: form.trainTickets,
      supportTickets: form.supportTickets,
      monthly: form.monthly,
      pass: form.pass,
      teamClass: form.teamClass,
      incomes: [...incomes, ...GIFT_INCOMES, ...competitionIncomes(schedule, form)],
    });
    return { p, pulls: pullsFor(p, target.lane, target.paidOnly) };
  }, [target, today, form, incomes, schedule]);

  return (
    <div className="calc-grid">
      <form className="calc-form box" onSubmit={(e) => e.preventDefault()} aria-label="내 보유량과 목표">
        <fieldset>
          <legend>지금 가진 쥬얼</legend>
          <NumberField id="calc-free" label="무료 쥬얼" unit="개" value={form.free} onChange={(free) => update({ free })} />
          <NumberField id="calc-paid" label="유료 쥬얼" unit="개" value={form.paid} onChange={(paid) => update({ paid })} />
        </fieldset>
        <fieldset>
          <legend>지금 가진 뽑기 티켓</legend>
          <NumberField
            id="calc-train"
            label="육성 우마무스메"
            unit="장"
            value={form.trainTickets}
            onChange={(trainTickets) => update({ trainTickets })}
          />
          <NumberField
            id="calc-support"
            label="서포트 카드"
            unit="장"
            value={form.supportTickets}
            onChange={(supportTickets) => update({ supportTickets })}
          />
        </fieldset>
        <label className="calc-check">
          <input type="checkbox" checked={form.monthly} onChange={(e) => update({ monthly: e.target.checked })} />
          <span>
            월정액을 계속 사요
            <small>
              살 때 유료 {jw(MONTHLY.paidOnBuy)}, {MONTHLY.days}일 동안 매일 무료 {jw(MONTHLY.freePerDay)}
            </small>
          </span>
        </label>
        <fieldset>
          <legend>트레이닝 패스</legend>
          {PASS_OPTIONS.map((o) => (
            <label key={o.value} className="calc-check">
              <input
                type="radio"
                name="calc-pass"
                value={o.value}
                checked={form.pass === o.value}
                onChange={() => update({ pass: o.value })}
              />
              <span>
                {o.label}
                {o.note && <small>{o.note}</small>}
              </span>
            </label>
          ))}
        </fieldset>
        <fieldset>
          <legend>대회·경기 보상</legend>
          <SelectField
            id="calc-team"
            label="팀 경기장 클래스 (매주 월요일)"
            value={String(form.teamClass)}
            options={TEAM_OPTIONS}
            onChange={(v) => update({ teamClass: Number(v) as TeamClass })}
          />
          <SelectField
            id="calc-cm-league"
            label="챔피언스 미팅 리그"
            value={form.cmLeague}
            options={CM_LEAGUE_OPTIONS}
            onChange={(v) => update({ cmLeague: v as CmLeague })}
          />
          <SelectField
            id="calc-cm-result"
            label="챔피언스 미팅 결승 결과 (매회 같다고 보고)"
            value={form.cmResult}
            options={CM_RESULT_OPTIONS}
            onChange={(v) => update({ cmResult: v as CmResult })}
          />
          <SelectField
            id="calc-loh"
            label="리그 오브 히어로즈 최종 랭크"
            value={String(form.lohRank)}
            options={LOH_OPTIONS}
            onChange={(v) => update({ lohRank: Number(v) })}
          />
          <label className="calc-check">
            <input
              type="checkbox"
              checked={form.legendRace}
              onChange={(e) => update({ legendRace: e.target.checked })}
            />
            <span>
              레전드 레이스에서 1착해요
              <small>상대 레전드마다 첫 1착 보상 쥬얼 {jw(LEGEND_RACE_FIRST_WIN)}, 개최마다 보통 2명</small>
            </span>
          </label>
        </fieldset>
        <div className="calc-field">
          <label htmlFor="calc-target">목표 픽업</label>
          <select
            id="calc-target"
            className="bp-select"
            value={target?.id ?? ""}
            onChange={(e) => update({ targetId: e.target.value ? Number(e.target.value) : null })}
          >
            <option value="">픽업을 골라 주세요</option>
            {gachas.map((g) => (
              <option key={g.id} value={g.id}>
                {gachaLabel(g)}
              </option>
            ))}
          </select>
        </div>
      </form>

      <section className="calc-result" aria-busy={!loaded}>
        {!target || !result ? (
          <div className="notice">
            <b>목표 픽업을 고르면 계산해요.</b>
            <p>
              {gachas.length > 0
                ? `한국서버 예상일로 앞으로 시작하는 픽업 ${gachas.length}개 중에서 고를 수 있어요.`
                : "앞으로 시작하는 픽업 일정이 아직 없어요."}
            </p>
          </div>
        ) : (
          <Result target={target} today={today} owned={form.free + form.paid} teamClass={form.teamClass} {...result} />
        )}
      </section>
    </div>
  );
}

function Result({
  target,
  today,
  owned,
  teamClass,
  p,
  pulls,
}: {
  target: Gacha;
  today: number;
  owned: number;
  teamClass: TeamClass;
  p: ReturnType<typeof plan>;
  pulls: ReturnType<typeof pullsFor>;
}) {
  const ceilingGap = CEILING - pulls.total;
  const legendRaces = p.incomes.filter((i) => i.source === "legend");
  const legendEditions = new Set(legendRaces.map((i) => legendEditionId(i.id))).size;
  const legendFree = legendRaces.reduce((a, i) => a + i.free, 0);
  const otherCompetitionCount = p.incomes.filter((i) => i.source === "cm" || i.source === "loh").length;
  const competitionCount = otherCompetitionCount + legendRaces.length;
  const giftCount = p.incomes.filter((i) => i.source === "gift" || i.source === "login").length;
  return (
    <>
      <div className={`calc-target calc-${target.lane}`}>
        <p className="calc-chips">
          <span className={`chip chip-${target.lane}`}>{LANE_NAME[target.lane]}</span>
          {target.paidOnly && <span className="chip chip-paid">유료 쥬얼 전용</span>}
        </p>
        <ul className="calc-picks">
          {target.pickups.slice(0, 3).map((pk) => (
            <li key={pk.id}>
              <CardArt lane={target.lane} src={pk.art} fallback={pk.thumb} />
              <div className="pick-text">
                <PickName pickup={pk} />
                {pk.title && <span className="pick-title">{pk.title}</span>}
              </div>
            </li>
          ))}
          {target.pickups.length > 3 && <li className="calc-more">외 {target.pickups.length - 3}명</li>}
        </ul>
        <p className="calc-when">
          <span className="dday">{formatDday(target.startKr - today)}</span>
          <span>
            <b>
              {formatFull(target.startKr)} ({weekday(target.startKr)}) 시작
            </b>
            <small>일본 {formatFull(target.startJp)}</small>
          </span>
        </p>
      </div>

      <div className="calc-total" aria-live="polite">
        <p className="calc-pulls">
          <b>{num(pulls.total)}</b>회
        </p>
        <p className="calc-pulls-how">
          {target.paidOnly ? (
            <>유료 쥬얼 전용 가챠라 유료 쥬얼 {jw(p.paid)}로만 계산했어요.</>
          ) : (
            <>
              쥬얼 {jw(p.free + p.paid)}로 {num(pulls.fromJewels)}회, {LANE_NAME[target.lane]} 티켓{" "}
              {tk(pulls.fromTickets)}으로 {num(pulls.fromTickets)}회
            </>
          )}
        </p>
        <p className="calc-ceiling">
          {ceilingGap > 0
            ? `천장 ${CEILING}회까지 ${num(ceilingGap)}회, ${target.paidOnly ? "유료 " : ""}쥬얼 ${jw(ceilingGap * JEWELS_PER_PULL)}가 더 필요해요.`
            : `천장 ${CEILING}회를 채우고 ${num(-ceilingGap)}회가 남아요.`}
        </p>
      </div>

      <dl className="calc-sum">
        <div>
          <dt>지금 가진 쥬얼</dt>
          <dd>{jw(owned)}</dd>
        </div>
        <div>
          <dt>
            데일리 미션 <small>{p.days}일 × {jw(DAILY_MISSION_JEWELS)}</small>
          </dt>
          <dd>+ {jw(p.daily)}</dd>
        </div>
        <div>
          <dt>
            로그인 보너스{" "}
            <small>
              {Math.floor(p.days / LOGIN_BONUS.days)}주 × {jw(LOGIN_BONUS.jewels)}
            </small>
          </dt>
          <dd>+ {jw(p.login)}</dd>
        </div>
        {p.monthlyPaid > 0 && (
          <div>
            <dt>
              월정액 <small>무료 {jw(p.monthlyFree)} · 유료 {jw(p.monthlyPaid)}</small>
            </dt>
            <dd>+ {jw(p.monthlyFree + p.monthlyPaid)}</dd>
          </div>
        )}
        {p.passPeriods > 0 && (
          <div>
            <dt>
              트레이닝 패스{" "}
              <small>
                {p.passPeriods}기간 · 무료 {jw(p.passFree)}
                {p.passPaid > 0 && ` · 유료 ${jw(p.passPaid)}`}
              </small>
            </dt>
            <dd>+ {jw(p.passFree + p.passPaid)}</dd>
          </div>
        )}
        <div>
          <dt>
            이벤트·미션 보상 <small>{p.incomes.length - competitionCount - giftCount}건</small>
          </dt>
          <dd>+ {jw(p.eventFree)}</dd>
        </div>
        {p.teamWeeks > 0 && (
          <div>
            <dt>
              팀 경기장{" "}
              <small>
                {p.teamWeeks}주 × {jw(TEAM_TRIALS_WEEKLY[teamClass])}
              </small>
            </dt>
            <dd>+ {jw(p.teamTrials)}</dd>
          </div>
        )}
        {otherCompetitionCount > 0 && (
          <div>
            <dt>
              챔피언스 미팅·리그 오브 히어로즈 <small>{otherCompetitionCount}회</small>
            </dt>
            <dd>+ {jw(p.competitionFree - legendFree)}</dd>
          </div>
        )}
        {legendRaces.length > 0 && (
          <div>
            <dt>
              레전드 레이스{" "}
              <small>
                {legendEditions}개최 · 레이스 {legendRaces.length}번 × {jw(LEGEND_RACE_FIRST_WIN)}
              </small>
            </dt>
            <dd>+ {jw(legendFree)}</dd>
          </div>
        )}
        {giftCount > 0 && (
          <div>
            <dt>
              운영 선물·특별 로그인 보너스 <small>{giftCount}건</small>
            </dt>
            <dd>+ {jw(p.giftFree)}</dd>
          </div>
        )}
        <div className="calc-sum-total">
          <dt>
            예상 쥬얼 수 <small>무료 {jw(p.free)} · 유료 {jw(p.paid)}</small>
          </dt>
          <dd>약 {jw(p.free + p.paid)}</dd>
        </div>
        <div>
          <dt>뽑기 티켓</dt>
          <dd>
            육성 {tk(p.trainTickets)} · 서포트 {tk(p.supportTickets)}
          </dd>
        </div>
      </dl>

      <h2 className="calc-h2">목표까지 받는 보상</h2>
      <ol className="route">
        <li className="route-stop route-today">
          <span className="route-date">
            <b>{formatShort(today)}</b>
            <small>오늘</small>
          </span>
          <span className="route-name">지금 입력한 보유량에서 출발</span>
        </li>
        {p.incomes.map((i) => (
          <li key={i.id} className="route-stop">
            <span className="route-date">
              <b>{formatShort(i.startKr)}</b>
              <small>일본 {formatShort(krToJp(i.startKr))}</small>
            </span>
            <span className="route-name">
              {i.name}
              <small>{SOURCE_NAME[i.source]}</small>
            </span>
            <Rewards i={i} />
          </li>
        ))}
        {p.incomes.length === 0 && (
          <li className="route-stop route-none">
            <span className="route-date" />
            <span className="route-name">이 구간에 시작하는 이벤트·미션 보상이 없어요.</span>
          </li>
        )}
        <li className={`route-stop route-goal calc-${target.lane}`}>
          <span className="route-date">
            <b>{formatShort(target.startKr)}</b>
            <small>목표</small>
          </span>
          <span className="route-name">{target.pickups.map((pk) => pk.name).join(", ")} 픽업 시작</span>
        </li>
      </ol>

      <p className="calc-notes">참고용 수치이며 사료의 양은 추가되거나 줄어들 수 있습니다.</p>
    </>
  );
}
