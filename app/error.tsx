"use client";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="panel glass empty" role="alert">
      <p>화면을 그리는 중에 문제가 생겼습니다. 외부 데이터(gametora.com) 응답이 늦거나 끊겼을 수 있습니다.</p>
      <button type="button" className="btn primary" onClick={reset} style={{ marginTop: 12 }}>
        다시 불러오기
      </button>
    </div>
  );
}
