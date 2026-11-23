import type { Metadata } from "next";
import { SimulatorScreen } from "./SimulatorScreen";

export const metadata: Metadata = { title: "뽑기 시뮬레이터" };
export const revalidate = 3600;

export default function SimulatorPage() {
  return <SimulatorScreen lane="train" bannerId={null} />;
}
