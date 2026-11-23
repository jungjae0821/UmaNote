import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SimulatorScreen } from "../../SimulatorScreen";

// /simulator?lane=…&banner=… 주소를 next.config.ts에서 이 경로로 바꿔 보낸다.
// 주소별로 처음 요청될 때 만들어 두고 한 시간 동안 그대로 쓴다
export const metadata: Metadata = { title: "뽑기 시뮬레이터" };
export const revalidate = 3600;

export function generateStaticParams() {
  return [];
}

export default async function SimulatorBannerPage({ params }: { params: Promise<{ lane: string; banner: string }> }) {
  const { lane, banner } = await params;
  if (lane !== "train" && lane !== "support") notFound();
  if (banner !== "latest" && !/^\d+$/.test(banner)) notFound();
  return <SimulatorScreen lane={lane} bannerId={banner === "latest" ? null : Number(banner)} />;
}
