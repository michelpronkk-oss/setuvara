// The locked "Meet" mark: a heavy S split once by a 60° cut. One color, inherits currentColor.
export const meetMarkTop = "M66.62 10.38A26 26 0 1 0 37 52.89L43.25 56.49L52.25 40.91L46 37.3A8 8 0 1 1 57.15 26.78Z";
export const meetMarkBottom = "M33.38 89.62A26 26 0 1 0 63 47.11L56.75 43.51L47.75 59.09L54 62.7A8 8 0 1 1 42.85 73.22Z";

export function MeetMark({ className = "", title }: { className?: string; title?: string }) {
  return (
    <svg aria-hidden={title ? undefined : true} className={className} fill="currentColor" focusable="false" role={title ? "img" : undefined} viewBox="0 0 100 100">
      {title ? <title>{title}</title> : null}
      <path d={meetMarkTop} />
      <path d={meetMarkBottom} />
    </svg>
  );
}

/** The two halves of the mark meeting along the cut. Animation is CSS-only (see marketing.css). */
export function MeetMarkJoin({ className = "" }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={`meet-join ${className}`} fill="currentColor" focusable="false" viewBox="0 0 100 100">
      <path className="meet-join-top" d={meetMarkTop} />
      <path className="meet-join-bottom" d={meetMarkBottom} />
    </svg>
  );
}

export function Wordmark({ className = "" }: { className?: string }) {
  return <span className={`font-display font-bold lowercase tracking-[-0.05em] ${className}`}>setuvara</span>;
}
