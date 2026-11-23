import { relative } from "@/lib/dates";

/** "● 10일 남음" / "● 3일 후 시작". dark는 이미지 위에 얹을 때 */
export function Live({ start, end, today, dark }: { start: number; end: number; today: number; dark?: boolean }) {
  const r = relative(start, end, today);
  return (
    <span className={`chip${r.state === "live" ? " live" : ""}${dark ? " dark" : ""}`}>
      <i aria-hidden />
      {r.text}
    </span>
  );
}
