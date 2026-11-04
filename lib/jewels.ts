// 보유 쥬얼은 사료계산기에서 입력하고 이 브라우저에 저장한다. 홈은 읽기만 한다.
// 시뮬레이터 기록(umanote:sim:v1)과 같은 "umanote:이름:버전" 규칙
export const JEWELS_KEY = "umanote:jewels:v1";

export type Jewels = { paid: number; free: number };

export function readJewels(): Jewels | null {
  try {
    const raw = localStorage.getItem(JEWELS_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<Jewels>;
    if (typeof v.paid !== "number" || typeof v.free !== "number") return null;
    return { paid: v.paid, free: v.free };
  } catch {
    return null;
  }
}
