// gametora 한국어 표기 중 한국서버 공식 표기와 다른 것. 이름·카드 제목·이벤트 이름에 모두 적용한다
const KO_NAME_FIX: [RegExp, string][] = [[/베르시나/g, "비르시나"]];

/** gametora 한국어 문자열을 공식 표기로 고친다 */
export function fixKo<T extends string | undefined>(text: T): T {
  if (!text) return text;
  return KO_NAME_FIX.reduce((s, [from, to]) => s.replace(from, to), text as string) as T;
}

/** "[맑은 섬에 핀 아름다운 꽃]" → "맑은 섬에 핀 아름다운 꽃" */
export function stripBrackets(title: string | undefined): string {
  return (title ?? "").replace(/^\[(.*)\]$/, "$1");
}
