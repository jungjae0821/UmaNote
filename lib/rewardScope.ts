/** 일일 미션은 별도 합산한다. 이벤트 및 운영팀 별도 지급 보상을 허용한다. */
export function isEventReward(row: { source: string; category?: string; name: string }): boolean {
  const category=row.category??row.source;
  if(category==='anniversary-gift')return true;
  if(row.source==='gift')return true;
  if(/monthly-shop|mainStory|permanent|achievement|dailyLegend|umaStory/.test(category))return false;
  if(row.source==='login')return !/일반 로그인|通常ログイン|スタートダッシュ|カムバック/.test(row.name);
  return true;
}
