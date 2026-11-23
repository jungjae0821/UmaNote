// umapyoi.net 캐릭터 프로필. gametora에 없는 학년만 가져온다.
import "server-only";
import { fetchJson, logFailure } from "./fetchJson";

const GRADE_KO: Record<string, string> = {
  "Middle School": "중등부",
  "High School": "고등부",
  "???": "???",
};

/** 학년이 없거나(트레센 학생이 아닌 캐릭터) 불러오지 못하면 null */
export async function getGrade(charId: number): Promise<string | null> {
  try {
    const d = await fetchJson<{ grade: string | null }>(`https://umapyoi.net/api/v1/character/${charId}`, 86400);
    return d.grade ? (GRADE_KO[d.grade] ?? null) : null;
  } catch (err) {
    logFailure("umapyoi 프로필", err);
    return null;
  }
}
