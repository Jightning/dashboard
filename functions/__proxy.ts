/**
 * Cloudflare Pages Function serving the same /__proxy?url= contract as the
 * dev server middleware (vite.config.ts) — the hosted browser build's web
 * tools (wrapWebFetch) route through here because arbitrary sites don't
 * send CORS headers. Fresh outbound fetch (no cookie/header forwarding);
 * only content-type is copied back.
 */
interface ProxyContext {
    request: Request;
}

export async function onRequest({ request }: ProxyContext): Promise<Response> {
    const url = new URL(request.url).searchParams.get("url");
    if (!url) return new Response("missing url", { status: 400 });
    let target: URL;
    try {
        target = new URL(url);
    } catch {
        return new Response("invalid url", { status: 400 });
    }
    if (target.protocol !== "http:" && target.protocol !== "https:")
        return new Response("http(s) only", { status: 400 });
    try {
        const upstream = await fetch(target.toString(), {
            headers: { accept: "text/html, text/plain, application/json" },
            redirect: "follow",
        });
        return new Response(upstream.body, {
            status: upstream.status,
            headers: {
                "content-type":
                    upstream.headers.get("content-type") ?? "text/plain",
            },
        });
    } catch (e) {
        return new Response(
            `proxy fetch failed: ${e instanceof Error ? e.message : String(e)}`,
            { status: 502 },
        );
    }
}
