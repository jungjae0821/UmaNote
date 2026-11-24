import { revalidatePath } from "next/cache";

// Vercel 크론이 한국시간 0시(날짜 바뀜)와 12시(픽업 전환)에 부른다 (vercel.json).
// 캐시된 페이지는 만료 뒤 첫 방문자에게 예전 화면을 한 번 더 보여 주므로, 한동안 방문이 없으면
// 오늘 날짜·진행 중 픽업이 하루 넘게 밀릴 수 있다. 이때 모든 페이지를 비워 다음 방문에 새로 그리게 한다.
export const dynamic = "force-dynamic";

export function GET(request: Request) {
  // CRON_SECRET을 설정하면 Vercel이 Authorization 헤더로 붙여 보낸다. 다른 곳에서 마구 부르지 못하게 막는다
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ revalidated: false }, { status: 401 });
  }
  revalidatePath("/", "layout");
  return Response.json({ revalidated: true, at: new Date().toISOString() });
}
