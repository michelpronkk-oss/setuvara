type JsonLdProps = { data: Record<string, unknown> | Record<string, unknown>[] };

/** Serialize structured data without allowing user text to escape its script element. */
export function JsonLd({ data }: JsonLdProps) {
  const serialized = JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");

  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serialized }} />;
}
