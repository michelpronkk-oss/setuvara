export default function AppLoading() {
  return (
    <div aria-label="Loading your Setuvara" className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-7 sm:px-6 sm:py-10" role="status">
      <div className="min-h-64 animate-pulse rounded-[2rem] bg-[#0d0d0d]/10 sm:min-h-72" />
      <div className="grid gap-6 lg:grid-cols-2"><div className="min-h-64 animate-pulse rounded-[1.7rem] bg-white/70" /><div className="min-h-64 animate-pulse rounded-[1.7rem] bg-white/70" /></div>
      <span className="sr-only">Loading your Setuvara…</span>
    </div>
  );
}
