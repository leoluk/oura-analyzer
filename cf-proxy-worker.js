/*
    Simple CORP proxy CloudFlare worker which forwards requests to api.ouraring.com.

    Prod instance on https://oura-cors-proxy.b1.workers.dev/:
     https://dash.cloudflare.com/4177f94cdc2f127a2679d700c8bddbb7/workers/services/edit/oura-cors-proxy/production
*/

async function handleRequest(request) {
    // Respond to OPTIONS requests
    if (request.method === "OPTIONS") {
        return new Response(null, {
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, HEAD, POST, OPTIONS",
                "Access-Control-Allow-Headers": "Cache-Control, Authorization, Content-Type",
            },
        });
    }

    const url = new URL(request.url);
    const response = await fetch(`https://api.ouraring.com${url.pathname + url.search}`, {
        method: request.method,
        headers: request.headers,
        body: request.body,
        cf: {
            cacheTtl: -1,
        }
    });

    const responseHeaders = new Headers(response.headers);
    responseHeaders.set("Access-Control-Allow-Origin", "*");
    responseHeaders.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    responseHeaders.set("Access-Control-Allow-Headers", "Cache-Control, Authorization, Content-Type");
    responseHeaders.set("Access-Control-Max-Age", "86400");

    return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
    });
}

addEventListener("fetch", async event => {
    event.respondWith(handleRequest(event.request))
})
