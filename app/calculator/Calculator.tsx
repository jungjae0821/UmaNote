"use client";

import { useEffect, useMemo, useState } from "react";
import { pickupLabel, type ViewBanner } from "@/lib/bannerView";
import { formatDday, formatFull, formatMd, formatMdTime, weekday } from "@/lib/dates";
import { useToday } from "@/lib/useToday";
import { CEILING, DAILY_MISSION_JEWELS, JEWELS_PER_PULL, MONTHLY, plan, pullsFor, SHOP_MONTHLY, TRAINING_PASS, type Income, type PassPlan } from "@/lib/jewelPlan";
import {
  competitionIncomes,
  giftIncomes,
  LEGEND_RACE_FIRST_WIN,
  LOGIN_BONUS,
  LOH_RANKS,
  lohJewels,
  TEAM_TRIALS_WEEKLY,
  type CmLeague,
  type CmResult,
  type Scheduled,
  type TeamClass,
} from "@/lib/jewelSources";
import { CRYSTAL_FIELDS, CRYSTAL_NAMES } from "@/lib/rewards";
import { currentJewels, EMPTY_CALC, readCalc, readJewels, writeCalc, writeJewels, writeSummary, type CalcInput, type Jewels, type SavedJewels } from "@/lib/jewels";
import { DAILY_RESET_HOUR, dailyJewels } from "@/lib/dailyReset";

const num = (n: number) => n.toLocaleString("ko-KR");
const LANE_NAME = { train: "육성", support: "서포트" } as const;

const { standard: PASS_STD, premium: PASS_PRE } = TRAINING_PASS;
const PASS_OPTIONS: { value: PassPlan; label: string }[] = [
  { value: "none", label: "넣지 않음" },
  { value: "standard", label: `무료 보상만 (한 달마다 쥬얼 ${num(PASS_STD.free)}, 티켓 ${PASS_STD.trainTickets}장씩)` },
  { value: "premium", label: `프리미엄 패스 (살 때 유료 ${num(PASS_PRE.paidOnBuy)}, 쥬얼 ${num(PASS_STD.free + PASS_PRE.free)}, 티켓 ${PASS_STD.trainTickets + PASS_PRE.trainTickets}장씩)` },
];
const TEAM_OPTIONS = [{ value: "0", label: "넣지 않음" }, ...[6, 5, 4, 3, 2, 1].map((c) => ({ value: String(c), label: `클래스 ${c} · 매주 ${num(TEAM_TRIALS_WEEKLY[c])}` }))];
const CM_RESULT_OPTIONS: { value: CmResult; label: string }[] = [
  { value: "none", label: "넣지 않음" },
  { value: "A1", label: "A결승 1위" },
  { value: "A2", label: "A결승 2위" },
  { value: "A3", label: "A결승 3위" },
  { value: "B1", label: "B결승 1위" },
  { value: "B2", label: "B결승 2위" },
  { value: "B3", label: "B결승 3위" },
  { value: "out", label: "결승 1~3위 밖" },
];
const LOH_OPTIONS = [{ value: "-1", label: "넣지 않음" }, ...LOH_RANKS.map((r, i) => ({ value: String(i), label: `${r.name} · 합계 ${num(lohJewels(i))}` })).reverse()];

const SOURCE_NAME: Record<Income["source"], string> = {
  story: "스토리 이벤트 보상",
  limited: "기간 한정 미션 (일본 일정 +476일 예상)",
  cm: "챔피언스 미팅 결승",
  legend: "레전드 레이스 첫 1착",
  loh: "리그 오브 히어로즈 랭크",
  gift: "운영 선물 (일본 공지 +476일 예상)",
  login: "특별 로그인 보너스 (일본 공지 +476일 예상)",
};

const GIFT_INCOMES = giftIncomes();

/** 게임에서 실제로 가질 수 있는 양보다 넉넉한 상한. 숫자를 잘못 눌러 결과가 터무니없이 커지는 것을 막는다 */
const MAX_COUNT = 9_999_999;

function toCount(value: string): number {
  // 아주 긴 숫자를 붙여 넣으면 Infinity가 되므로 NaN만 0으로 보고 나머지는 상한으로 자른다
  const n = Math.floor(Number(value.replace(/[^\d]/g, "")));
  return Number.isNaN(n) ? 0 : Math.min(n, MAX_COUNT);
}

function NumberField({ id, label, unit, value, onChange }: { id: string; label: string; unit: string; value: number; onChange: (n: number) => void }) {
  return (
    <label className="field" htmlFor={id}>
      <span>{label}</span>
      <span className="num-input">
        <input id={id} className="input" type="text" inputMode="numeric" autoComplete="off" value={value === 0 ? "" : num(value)} placeholder="0" onChange={(e) => onChange(toCount(e.target.value))} />
        <em>{unit}</em>
      </span>
    </label>
  );
}

function SelectField({ id, label, value, options, onChange }: { id: string; label: string; value: string; options: { value: string; label: string }[]; onChange: (v: string) => void }) {
  return (
    <label className="field" htmlFor={id}>
      <span>{label}</span>
      <select id={id} className="input" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

type Props = { today: number; targets: ViewBanner[]; incomes: Income[]; schedule: Scheduled[] };

export function Calculator({ today: serverToday, targets: allTargets, incomes, schedule }: Props) {
  const [form, setForm] = useState<CalcInput>(EMPTY_CALC);
  // 보유 쥬얼은 입력한 값과 입력 시각으로 저장하고, 화면에는 그 뒤 일일 초기화만큼 데일리를 더한 값을 보여준다
  const [saved, setSaved] = useState<SavedJewels | null>(null);
  const [now, setNow] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const today = useToday(serverToday);

  useEffect(() => {
    setForm(readCalc());
    setSaved(readJewels());
    setNow(Date.now());
    setLoaded(true);
    // 열어 둔 채 05:00을 넘겨도 데일리가 더해지게 1분마다 시각을 갱신한다
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const owned = saved ? currentJewels(saved, form.monthly, now) : { paid: 0, free: 0, accrual: { days: 0, jewels: 0 } };

  const targets = useMemo(() => allTargets.filter((g) => g.start > today), [allTargets, today]);

  function update(patch: Partial<CalcInput>) {
    // 월정액을 바꾸면 하루에 더하는 양이 달라지므로, 지금까지 더한 값을 먼저 확정해 둔다
    if ("monthly" in patch && saved && patch.monthly !== form.monthly) setSaved(writeJewels(owned));
    setForm((prev) => {
      const next = { ...prev, ...patch };
      writeCalc(next);
      return next;
    });
  }

  function updateJewels(patch: Partial<Jewels>) {
    setSaved(writeJewels({ paid: owned.paid, free: owned.free, ...patch }));
  }

  const target = targets.find((g) => g.id === form.targetId) ?? null;

  const result = useMemo(() => {
    if (!target) return null;
    const p = plan({
      today,
      target: target.start,
      paid: owned.paid,
      free: owned.free,
      trainTickets: form.trainTickets,
      supportTickets: form.supportTickets,
      rainbowShards: form.rainbowShards,
      goldShards: form.goldShards,
      monthly: form.monthly,
      pass: form.pass,
      teamClass: form.teamClass,
      shop: form.shop,
      incomes: [...incomes, ...GIFT_INCOMES, ...competitionIncomes(schedule, form)],
    });
    return { p, pulls: pullsFor(p, target.lane, target.paidOnly) };
  }, [target, today, form, owned.paid, owned.free, incomes, schedule]);

  useEffect(() => {
    if (!loaded) return;
    writeSummary(target && result ? { targetName: pickupLabel(target, 1), targetDay: target.start, jewels: result.p.free + result.p.paid, pulls: result.pulls.total } : null);
  }, [loaded, target, result]);

  return (
    <div className="calc">
      <form className="calc-form stack" onSubmit={(e) => e.preventDefault()} aria-label="보유량과 목표">
        <section className="panel glass">
          <h2 className="calc-h">보유</h2>
          <div className="calc-grid2 calc-owned">
            <NumberField id="c-free" label="무료 쥬얼" unit="개" value={owned.free} onChange={(free) => updateJewels({ free })} />
            <NumberField id="c-paid" label="유료 쥬얼" unit="개" value={owned.paid} onChange={(paid) => updateJewels({ paid })} />
            <NumberField id="c-tt" label="육성 티켓" unit="장" value={form.trainTickets} onChange={(trainTickets) => update({ trainTickets })} />
            <NumberField id="c-st" label="서포트 티켓" unit="장" value={form.supportTickets} onChange={(supportTickets) => update({ supportTickets })} />
            <NumberField id="c-rs" label="무지개 결정 조각" unit="개" value={form.rainbowShards} onChange={(rainbowShards) => update({ rainbowShards })} />
            <NumberField id="c-gs" label="금 결정 조각" unit="개" value={form.goldShards} onChange={(goldShards) => update({ goldShards })} />
          </div>
          <p className="calc-daily" aria-live="polite">
            {saved && owned.accrual.days > 0
              ? `${formatMdTime(Math.floor(saved.savedAt / 1000))}에 입력한 무료 쥬얼 ${num(saved.free)}에 일일 초기화 ${owned.accrual.days}번분 데일리 +${num(owned.accrual.jewels)}을 더했습니다. 실제와 다르면 다시 입력하세요.`
              : `매일 ${String(DAILY_RESET_HOUR).padStart(2, "0")}:00 초기화 때 무료 쥬얼에 ${form.monthly ? `데일리 미션 ${num(DAILY_MISSION_JEWELS)}과 월정액 ${num(MONTHLY.freePerDay)}, 하루 ${num(dailyJewels(true))}` : `데일리 미션 ${num(DAILY_MISSION_JEWELS)}`}이 자동으로 더해집니다.`}
          </p>
        </section>

        <section className="panel glass">
          <h2 className="calc-h">받을 보상</h2>
          <div className="calc-grid2">
            <label className="check">
              <input type="checkbox" checked={form.monthly} onChange={(e) => update({ monthly: e.target.checked })} />
              <span>
                월정액을 계속 산다
                <small>
                  살 때 유료 {num(MONTHLY.paidOnBuy)}, {MONTHLY.days}일 동안 매일 무료 {num(MONTHLY.freePerDay)}
                </small>
              </span>
            </label>
            <label className="check">
              <input type="checkbox" checked={form.legendRace} onChange={(e) => update({ legendRace: e.target.checked })} />
              <span>
                레전드 레이스에서 1착한다
                <small>상대마다 첫 1착 쥬얼 {num(LEGEND_RACE_FIRST_WIN)}</small>
              </span>
            </label>
            <SelectField id="c-pass" label="시즌 패스" value={form.pass} options={PASS_OPTIONS} onChange={(v) => update({ pass: v as PassPlan })} />
            <SelectField id="c-team" label="팀 경기장 클래스 (매주 월요일)" value={String(form.teamClass)} options={TEAM_OPTIONS} onChange={(v) => update({ teamClass: Number(v) as TeamClass })} />
            <SelectField
              id="c-cml"
              label="챔피언스 미팅 리그"
              value={form.cmLeague}
              options={[
                { value: "grade", label: "그레이드 리그" },
                { value: "open", label: "오픈 리그" },
              ]}
              onChange={(v) => update({ cmLeague: v as CmLeague })}
            />
            <SelectField id="c-cmr" label="챔피언스 미팅 결승 결과 (매회 같다고 봄)" value={form.cmResult} options={CM_RESULT_OPTIONS} onChange={(v) => update({ cmResult: v as CmResult })} />
            <SelectField id="c-loh" label="리그 오브 히어로즈 최종 랭크" value={String(form.lohRank)} options={LOH_OPTIONS} onChange={(v) => update({ lohRank: Number(v) })} />
          </div>
        </section>

        <section className="panel glass">
          <h2 className="calc-h">상점 월간 교환 (매달 1일 초기화)</h2>
          <div className="calc-grid2">
            {SHOP_MONTHLY.map((s) => (
              <label key={s.id} className="check">
                <input
                  type="checkbox"
                  checked={form.shop.includes(s.id)}
                  onChange={(e) => update({ shop: e.target.checked ? [...form.shop, s.id] : form.shop.filter((x) => x !== s.id) })}
                />
                <span>
                  {s.name}
                  <small>
                    {s.perMonth > 0 ? `${s.cost}씩, 육성·서포트 티켓 매달 ${s.perMonth}장씩` : `${s.cost}, 무지개·금 결정 조각 매달 ${s.shardsPerMonth}개씩`}
                  </small>
                </span>
              </label>
            ))}
          </div>
        </section>

        <section className="panel glass">
          <h2 className="calc-h">목표 픽업</h2>
          <SelectField
            id="c-target"
            label={`일본서버에서 진행 중인 픽업까지 ${targets.length}개`}
            value={target ? String(target.id) : ""}
            options={[
              { value: "", label: "픽업을 골라 주세요" },
              ...targets.map((g) => ({
                value: String(g.id),
                label: `${formatFull(g.start)} ${LANE_NAME[g.lane]} · ${pickupLabel(g)}${g.estimated ? " (예상)" : ""}`,
              })),
            ]}
            onChange={(v) => update({ targetId: v ? Number(v) : null })}
          />
        </section>
      </form>

      <section id="calc-result" className="calc-result panel glass" aria-busy={!loaded} aria-live="polite">
        {!target || !result ? (
          <p className="empty">목표 픽업을 고르면 그날까지 모이는 쥬얼과 뽑기 횟수를 계산합니다.</p>
        ) : (
          <Result target={target} today={today} owned={owned.free + owned.paid} teamClass={form.teamClass} {...result} />
        )}
      </section>

      {target && result && (
        <a href="#calc-result" className="calc-sticky glass">
          <span>
            {pickupLabel(target, 1)} · {formatDday(target.start - today)}
          </span>
          <b>
            {num(result.pulls.total)}회 · {num(result.p.free + result.p.paid)} 쥬얼
          </b>
        </a>
      )}
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
  target: ViewBanner;
  today: number;
  owned: number;
  teamClass: TeamClass;
  p: ReturnType<typeof plan>;
  pulls: ReturnType<typeof pullsFor>;
}) {
  const ceilingGap = CEILING - pulls.total;
  const legend = p.incomes.filter((i) => i.source === "legend");
  const legendFree = legend.reduce((a, i) => a + i.free, 0);
  const cmLoh = p.incomes.filter((i) => i.source === "cm" || i.source === "loh");
  const gifts = p.incomes.filter((i) => i.source === "gift" || i.source === "login");
  const events = p.incomes.length - legend.length - cmLoh.length - gifts.length;
  const earned = CRYSTAL_FIELDS.filter((k) => (p.earnedMaterials[k] ?? 0) > 0);
  const shown = CRYSTAL_FIELDS.filter((k) => (p[k] ?? 0) > 0);
  const shardSources = p.incomes.filter((i) => CRYSTAL_FIELDS.some((k) => (i[k] ?? 0) > 0)).length;
  const passShards = (p.earnedMaterials.rainbowShards ?? 0) - p.incomes.reduce((a, i) => a + (i.rainbowShards ?? 0), 0) - p.shopShards;

  const rows: { label: string; note?: string; value: number }[] = [
    { label: "지금 가진 쥬얼", value: owned },
    { label: "데일리 미션", note: `${p.days}일 × ${DAILY_MISSION_JEWELS}`, value: p.daily },
    { label: "로그인 보너스", note: `${Math.floor(p.days / LOGIN_BONUS.days)}주 × ${LOGIN_BONUS.jewels}`, value: p.login },
    ...(p.monthlyPaid > 0 ? [{ label: "월정액", note: `무료 ${num(p.monthlyFree)} · 유료 ${num(p.monthlyPaid)}`, value: p.monthlyFree + p.monthlyPaid }] : []),
    ...(p.passPeriods > 0 ? [{ label: "시즌 패스", note: `${p.passPeriods}기간`, value: p.passFree + p.passPaid }] : []),
    { label: "이벤트·미션 보상", note: `${events}건`, value: p.eventFree },
    ...(p.teamWeeks > 0 ? [{ label: "팀 경기장", note: `${p.teamWeeks}주 × ${TEAM_TRIALS_WEEKLY[teamClass]}`, value: p.teamTrials }] : []),
    ...(cmLoh.length > 0 ? [{ label: "챔피언스 미팅·리그 오브 히어로즈", note: `${cmLoh.length}회`, value: p.competitionFree - legendFree }] : []),
    ...(legend.length > 0 ? [{ label: "레전드 레이스", note: `${legend.length}번`, value: legendFree }] : []),
    ...(gifts.length > 0 ? [{ label: "운영 선물·특별 로그인", note: `${gifts.length}건, 예상`, value: p.giftFree }] : []),
  ];

  return (
    <>
      <div className="res-target">
        <span className="res-faces">
          {target.pickups.slice(0, 3).map((pk) => (
            <img key={pk.id} src={pk.art} alt="" />
          ))}
        </span>
        <div>
          <p className="res-name">{pickupLabel(target)}</p>
          <p className="res-when">
            <span className={`tag ${target.lane}`}>{LANE_NAME[target.lane]}</span>
            {target.paidOnly && <span className="tag">유료 쥬얼 전용</span>}
            {formatFull(target.start)} ({weekday(target.start)}) 시작 · {formatDday(target.start - today)}
          </p>
        </div>
      </div>

      <div className="res-big">
        <p>
          <b>{num(p.free + p.paid)}</b> 쥬얼
        </p>
        <p>
          <b>{num(pulls.total)}</b>회
        </p>
      </div>
      <p className="res-how">
        {target.paidOnly
          ? `유료 쥬얼 전용이라 유료 쥬얼 ${num(p.paid)}개로만 계산했습니다.`
          : `쥬얼로 ${num(pulls.fromJewels)}회 + ${LANE_NAME[target.lane]} 티켓 ${num(pulls.fromTickets)}장`}
      </p>
      <p className="res-ceil">
        {ceilingGap > 0
          ? `천장 ${CEILING}회까지 ${num(ceilingGap)}회, 쥬얼 ${num(ceilingGap * JEWELS_PER_PULL)}개 더 필요`
          : `천장 ${CEILING}회를 채우고 ${num(-ceilingGap)}회 남음`}
      </p>

      <dl className="res-sum">
        {rows.map((r) => (
          <div key={r.label}>
            <dt>
              {r.label}
              {r.note && <small>{r.note}</small>}
            </dt>
            <dd>{r === rows[0] ? num(r.value) : `+ ${num(r.value)}`}</dd>
          </div>
        ))}
        <div className="res-total">
          <dt>
            합계 <small>무료 {num(p.free)} · 유료 {num(p.paid)}</small>
          </dt>
          <dd>{num(p.free + p.paid)}</dd>
        </div>
        <div>
          <dt>뽑기 티켓</dt>
          <dd>
            육성 {num(p.trainTickets)} · 서포트 {num(p.supportTickets)}
          </dd>
        </div>
        {shown.length > 0 && (
          <div>
            <dt>
              한계돌파 재료{" "}
              <small>
                받는 양 {earned.length > 0 ? earned.map((k) => `${CRYSTAL_NAMES[k]} ${num(p.earnedMaterials[k] ?? 0)}`).join(" · ") : "없음"}
                {(() => {
                  const parts = [shardSources > 0 && `보상 ${shardSources}건`, passShards > 0 && `프리미엄 패스 ${num(passShards)}개`, p.shopShards > 0 && `메달 교환 ${p.shopMonths}달 무지개·금 각 ${num(p.shopShards)}개`].filter(Boolean);
                  return parts.length ? ` (${parts.join(", ")} 포함)` : "";
                })()}
              </small>
            </dt>
            <dd>{shown.map((k) => `${CRYSTAL_NAMES[k]} ${num(p[k] ?? 0)}`).join(" · ")}</dd>
          </div>
        )}
        {p.shopTickets > 0 && (
          <div>
            <dt>
              그중 상점 월간 교환 <small>{p.shopMonths}달 × {num(p.shopTickets / p.shopMonths)}장</small>
            </dt>
            <dd>각 + {num(p.shopTickets)}장</dd>
          </div>
        )}
      </dl>

      <h3 className="res-h">더한 보상</h3>
      <ol className="res-route">
        {p.incomes.map((i) => (
          <li key={i.id}>
            <span className="rr-date">{formatMd(i.startKr)}</span>
            <span className="rr-name">
              {i.name}
              <small>{SOURCE_NAME[i.source]}</small>
            </span>
            <span className="rr-gain">
              {[i.free > 0 && `쥬얼 ${num(i.free)}`, i.trainTickets > 0 && `육성 ${i.trainTickets}장`, i.supportTickets > 0 && `서포트 ${i.supportTickets}장`, ...CRYSTAL_FIELDS.map((k) => (i[k] ?? 0) > 0 && `${CRYSTAL_NAMES[k]} ${i[k]}개`)].filter(Boolean).join(", ")}
            </span>
          </li>
        ))}
        {p.incomes.length === 0 && <li className="rr-none">이 기간에 시작하는 보상이 없습니다.</li>}
      </ol>
      <p className="res-note">뺀 항목: 신데렐라 그레이 방영 기념 쥬얼 캠페인(한일 동시 진행). 참고용 수치이며 실제 지급량은 달라질 수 있습니다.</p>
    </>
  );
}
