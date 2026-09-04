export default function Loading() {
  return (
    <main className="container-fluid py-4 px-4">
      <div className="card shadow-sm">
        <div className="card-body py-5 text-center text-secondary">
          <div className="spinner-border text-primary mb-3" role="status" aria-hidden="true" />
          <div className="fw-semibold">Loading page...</div>
          <div className="small">Please wait while IMS prepares this screen.</div>
        </div>
      </div>
    </main>
  );
}
