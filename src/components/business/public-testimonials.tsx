import { byline, type PublicTestimonial } from "@/lib/business/testimonials";

const label = "font-label text-[10.5px] uppercase tracking-[0.18em]";
const line = "color-mix(in srgb, currentColor 14%, transparent)";

/**
 * Approved client testimonials on a Business Mode page. It sits inside any Appearance, so colour
 * comes from currentColor and the page accent. Every one was invited by the owner and approved.
 */
export function PublicTestimonials({ items, accent }: { items: PublicTestimonial[]; accent: string }) {
  if (!items.length) return null;
  return (
    <section aria-label="What clients say" className="flex flex-col gap-3 text-left" data-testimonials={items.length}>
      <p className={`${label} opacity-60`}>What clients say</p>
      <ul className="-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
        {items.map((item) => {
          const who = byline(item);
          return (
            <li className={`flex shrink-0 snap-start flex-col gap-4 rounded-[22px] p-5 ${items.length === 1 ? "w-full" : "w-[86%] @min-[700px]/profile:w-[calc(50%-6px)]"}`} data-testimonial-id={item.id} key={item.id} style={{ boxShadow: `inset 0 0 0 1px ${line}` }}>
              <div className="flex items-center justify-between gap-3">
                <span aria-hidden="true" className="font-display text-[40px] font-bold leading-[0.6]" style={{ color: accent }}>&ldquo;</span>
                {item.rating && (
                  <span aria-label={`${item.rating} out of 5`} className="inline-flex gap-0.5" role="img">
                    {[1, 2, 3, 4, 5].map((star) => <svg aria-hidden="true" className={`size-3.5 ${star <= item.rating! ? "" : "opacity-20"}`} fill="currentColor" key={star} viewBox="0 0 20 20"><path d="m10 1.8 2.5 5.3 5.8.7-4.3 4 1.1 5.7L10 14.7l-5.1 2.8L6 11.8l-4.3-4 5.8-.7L10 1.8Z" /></svg>)}
                  </span>
                )}
              </div>
              <blockquote className="whitespace-pre-line text-[16px] leading-[1.5]">{item.body}</blockquote>
              <footer className="mt-auto flex flex-wrap items-center gap-x-2 gap-y-1 text-[14px]">
                <cite className="font-semibold not-italic">{item.author_name}</cite>
                {who && <span className="opacity-60">{who}</span>}
                {item.verified && <span className={`${label} rounded-full px-2 py-0.5 text-[9.5px]`} style={{ boxShadow: `inset 0 0 0 1px ${line}` }}>Verified client</span>}
              </footer>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
