"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { readJewels, type Jewels } from "@/lib/jewels";

const fmt = (n: number) => n.toLocaleString("ko-KR");

// 게임의 쥬얼 아이콘 (gametora). 참고 사이트에 유료 쥬얼 전용 이미지는 없어서 둘 다 같은 아이콘을 쓴다
const JEWEL_ICON = "https://gametora.com/images/umamusume/icons/jewel.png";

export function JewelSummary() {
  // undefined: 아직 브라우저 저장소를 읽기 전, null: 입력한 적 없음
  const [jewels, setJewels] = useState<Jewels | null | undefined>(undefined);

  useEffect(() => setJewels(readJewels()), []);

  const items = [
    { label: "유료 쥬얼", value: jewels?.paid },
    { label: "무료 쥬얼", value: jewels?.free },
  ];

  return (
    <section className="jewels" aria-label="보유 쥬얼">
      <ul>
        {items.map((it) => (
          <li key={it.label}>
            <img src={JEWEL_ICON} alt="" width={32} height={32} />
            <span className="jewels-label">{it.label}</span>
            <span className="jewels-value">
              {it.value === undefined ? <span className="jewels-none">입력 전</span> : fmt(it.value)}
            </span>
          </li>
        ))}
      </ul>
      <Link href="/calculator">{jewels ? "사료계산기에서 고치기" : "사료계산기에서 입력하기"}</Link>
    </section>
  );
}
