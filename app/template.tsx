// 페이지를 옮길 때마다 새로 그려져 본문이 살짝 떠오르며 나타난다.
// loading.tsx를 두지 않아서 다음 페이지가 준비될 때까지는 지금 페이지가 그대로 남는다
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-enter">{children}</div>;
}
