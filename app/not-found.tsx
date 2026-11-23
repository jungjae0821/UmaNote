import Link from "next/link";

export default function NotFound() {
  return (
    <div className="panel glass empty">
      <p>찾는 페이지가 없습니다. 주소가 바뀌었거나 잘못 입력됐을 수 있습니다.</p>
      <Link href="/" className="btn primary" style={{ marginTop: 12 }}>
        홈으로
      </Link>
    </div>
  );
}
