"use client";

import { useEffect, useState } from "react";
import { todayKr } from "./dates";

/** 브라우저 날짜가 이보다 크게 앞서면 시계가 틀렸다고 보고 서버 날짜를 그대로 쓴다 */
const MAX_STALE_DAYS = 30;

/**
 * 캐시된 페이지는 만들어진 날의 날짜를 들고 있어서, 자정을 넘기거나 한동안 방문이 없던 뒤에는 하루 이상 늦을 수 있다.
 * 첫 화면은 서버 날짜로 그려 hydration을 맞추고, 그 뒤 브라우저의 한국 날짜가 더 늦으면 그 날짜로 바꾼다.
 * 열어 둔 채 자정을 넘겨도 1분마다 다시 확인한다.
 */
export function useToday(serverToday: number): number {
  const [today, setToday] = useState(serverToday);
  useEffect(() => {
    const check = () => {
      const local = todayKr();
      setToday(local > serverToday && local - serverToday <= MAX_STALE_DAYS ? local : serverToday);
    };
    check();
    const timer = window.setInterval(check, 60_000);
    return () => window.clearInterval(timer);
  }, [serverToday]);
  return today;
}
