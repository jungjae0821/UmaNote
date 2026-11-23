"use client";

import { useRouter } from "next/navigation";
import type { Lane } from "@/lib/gametora";

export function BannerSelect({ lane, selected, options }: { lane: Lane; selected: number; options: { id: number; label: string }[] }) {
  const router = useRouter();
  return (
    <label className="field sim-select">
      <span>배너</span>
      <select className="input" value={selected} onChange={(e) => router.push(`/simulator?lane=${lane}&banner=${e.target.value}`)}>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
