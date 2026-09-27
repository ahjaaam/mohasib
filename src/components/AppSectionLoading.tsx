export default function AppSectionLoading() {
  return (
    <div className="animate-pulse" role="status" aria-label="Chargement de la section">
      <div className="h-6 w-48 bg-[#E8E8E3]" />
      <div className="mt-2 h-3 w-72 max-w-full bg-[#F0F0EC]" />
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {[0, 1, 2].map((item) => (
          <div key={item} className="h-24 border border-black/[0.06] bg-white" />
        ))}
      </div>
      <div className="mt-5 border border-black/[0.06] bg-white p-4">
        <div className="h-4 w-36 bg-[#E8E8E3]" />
        <div className="mt-4 space-y-3">
          {[0, 1, 2, 3].map((item) => (
            <div key={item} className="h-10 bg-[#F5F5F1]" />
          ))}
        </div>
      </div>
      <span className="sr-only">Chargement…</span>
    </div>
  );
}
