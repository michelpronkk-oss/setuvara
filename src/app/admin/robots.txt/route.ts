/** admin.setuvara.com/robots.txt: keep every crawler out. */
export function GET() {
  return new Response("User-agent: *\nDisallow: /\n", { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
