"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatMd } from "@/lib/dates";
import { readCalc, readJewels, readSummary, type CalcInput, type CalcSummary, type Jewels } from "@/lib/jewels";
import { Icon } from "./Icon";
import { useToday } from "@/lib/useToday";

const n = (v: number) => v.toLocaleString("ko-KR");

/** 사료계산기에 입력한 값을 이 브라우저에서 읽어 보여준다 */
export function HomeJewels({ today: serverToday }: { today: number }) {
  const today = useToday(serverToday);
  const [state, setState] = useState<{ jewels: Jewels | null; calc: CalcInput; summary: CalcSummary | null } | null>(null);

  useEffect(() => {
    setState({ jewels: readJewels(), calc: readCalc(), summary: readSummary() });
  }, []);

  if (!state) return <div className="panel glass jw" aria-busy="true" style={{ minHeight: 180 }} />;

  if (!state.jewels) {
    return (
      <div className="panel glass jw">
        <p className="jw-empty">보유 쥬얼을 입력하면 목표 픽업까지 모이는 양을 여기서 바로 볼 수 있습니다.</p>
        <Link href="/calculator" className="btn primary">
          사료계산기에서 입력하기
        </Link>
      </div>
    );
  }

  const s = state.summary && state.summary.targetDay > today ? state.summary : null;
  return (
    <div className="panel glass jw">
      <dl>
        <div>
          <dt>무료 쥬얼</dt>
          <dd>{n(state.jewels.free)}</dd>
        </div>
        <div>
          <dt>유료 쥬얼</dt>
          <dd>{n(state.jewels.paid)}</dd>
        </div>
        <div>
          <dt>육성 티켓</dt>
          <dd>{n(state.calc.trainTickets)}장</dd>
        </div>
        <div>
          <dt>서포트 티켓</dt>
          <dd>{n(state.calc.supportTickets)}장</dd>
        </div>
        {s && (
          <div className="goal">
            <dt>
              {s.targetName} ({formatMd(s.targetDay)})까지
            </dt>
            <dd>{n(s.jewels)} 쥬얼</dd>
            <dt>뽑기 {n(s.pulls)}회</dt>
          </div>
        )}
      </dl>
      <Link href="/calculator" className="more">
        사료계산기
        <Icon name="chevronRight" />
      </Link>
    </div>
  );
}
