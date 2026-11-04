/** 외부 API JSON을 Next.js 데이터 캐시에 revalidate초 동안 두고 가져온다 */
export async function fetchJson<T>(url: string, revalidate: number): Promise<T> {
  const res = await fetch(url, { next: { revalidate } });
  if (!res.ok) throw new Error(`${url} ${res.status}`);
  return res.json() as Promise<T>;
}

/** 실패해도 화면은 대체 값으로 그리되, 원인은 서버 로그에 남긴다 */
export function logFailure(what: string, err: unknown) {
  console.error(`[umanote] ${what} 불러오기 실패:`, err);
}
