export default function MessagesLoading() {
  return <main className="mx-auto max-w-[1250px] px-4 py-8 sm:px-6" role="status">
    <div className="h-7 w-44 animate-pulse rounded-full bg-black/10" />
    <div className="mt-7 grid min-h-[60vh] gap-4 lg:grid-cols-[340px_1fr]">
      <div className="animate-pulse rounded-[28px] bg-white" />
      <div className="hidden animate-pulse rounded-[28px] bg-white lg:block" />
    </div>
    <span className="sr-only">Loading messages</span>
  </main>;
}
