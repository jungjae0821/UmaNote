import { relative } from "@/lib/dates";

/** "10일 남음" / "3일 후 시작". 종료 3일 이내면 강조색. dark는 이미지 위에 얹을 때 */
export function Live({ start, end, today, dark }: { start: number; end: number; today: number; dark?: boolean }) {
  const r = relative(start, end, today);
  return <span className={`chip${r.urgent ? " urgent" : ""}${dark ? " dark" : ""}`}>{r.text}</span>;
}
