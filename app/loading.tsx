export default function Loading() {
  return (
    <main className="page home">
      <div className="map map-loading" role="status">
        <div className="map-loading-lines" aria-hidden="true">
          <i className="lg-train" />
          <i className="lg-support" />
        </div>
        <p>umapyoi.net에서 픽업 일정을 불러오는 중이에요.</p>
      </div>
    </main>
  );
}
