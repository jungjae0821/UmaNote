import Link from "next/link";

export function ComingSoon({ title }: { title: string }) {
  return (
    <main className="page coming">
      <h1>{title}</h1>
      <p>이 화면은 아직 만들고 있어요. 지금은 홈에서 픽업 노선도와 진행 중인 픽업을 볼 수 있어요.</p>
      <Link href="/" className="btn">
        홈으로 가기
      </Link>
    </main>
  );
}
