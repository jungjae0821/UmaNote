import Link from "next/link";

export default function CharacterNotFound() {
  return (
    <div className="panel glass empty">
      <p>찾는 캐릭터가 없습니다. 캐릭터 주소가 바뀌었거나 아직 한국서버 데이터에 없는 카드일 수 있습니다.</p>
      <Link href="/characters" className="btn primary" style={{ marginTop: 12 }}>
        캐릭터 목록으로
      </Link>
    </div>
  );
}
