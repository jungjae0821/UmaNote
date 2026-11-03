"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { formatDday, formatFull, formatShort } from "@/lib/dates";
import type { BannerOption } from "@/lib/gachaPool";
import type { Lane } from "@/lib/umapyoi";

type Props = { lane: Lane; banners: BannerOption[]; selected: BannerOption; today: number };

function status(b: BannerOption, today: number) {
  if (b.endKr < today) return "종료";
  if (b.startKr <= today) return `진행 중 ${formatDday(b.endKr - today)}`;
  return formatDday(b.startKr - today);
}

// 배너가 수백 개라 고르는 칸은 기본 select로 둔다. 한국 예상 시작일이 앞에 오도록
export function BannerPicker({ lane, banners, selected, today }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <div className="bp">
      <label className="bp-label" htmlFor="bp-select">
        배너
      </label>
      <select
        id="bp-select"
        className="bp-select"
        value={selected.id}
        aria-busy={pending}
        onChange={(e) => {
          const href = `/simulator?lane=${lane}&banner=${e.target.value}`;
          startTransition(() => router.push(href));
        }}
      >
        {banners.map((b) => (
          <option key={b.id} value={b.id}>
            {formatFull(b.startKr)} {b.label}
          </option>
        ))}
      </select>
      {pending ? (
        <p className="bp-period" role="status">
          배너 정보를 불러오는 중이에요.
        </p>
      ) : (
        <p className="bp-period">
          <b>
            {formatShort(selected.startKr)} – {formatShort(selected.endKr)}
          </b>
          <span className={`bp-status${selected.startKr <= today && today <= selected.endKr ? " is-live" : ""}`}>
            {status(selected, today)}
          </span>
          <small>
            일본 {formatFull(selected.startJp)} – {formatShort(selected.endJp)}
          </small>
        </p>
      )}
    </div>
  );
}
