import "server-only";

/** uma.guide 뽑기 플래너의 앱 모듈과 데이터 모듈. 몇 MB짜리라 호출하는 쪽에서 작게 줄여 캐시한다 */
export async function fetchPlannerModules(): Promise<{ app: string; source: string }> {
  const text = async (url: string) => {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) throw Error(`Planner schedule ${response.status}`);
    return response.text();
  };
  const html = await text("https://uma.guide/pull-planner/");
  const path = html.match(/<script[^>]*src="([^" ]*\/app\.[^" ]+\.js)"/)?.[1];
  if (!path) throw Error("Planner app module missing");
  const appUrl = new URL(path, "https://uma.guide");
  if (appUrl.origin !== "https://uma.guide") throw Error("Unexpected planner origin");
  const app = await text(appUrl.href);
  const dataPath = app.match(/from"(\.\/chunks\/uma-data\.[^"]+\.js)"/)?.[1];
  if (!dataPath) throw Error("Planner schedule module missing");
  return { app, source: await text(new URL(dataPath, appUrl).href) };
}
