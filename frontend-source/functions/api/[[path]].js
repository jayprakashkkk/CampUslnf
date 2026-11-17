export async function onRequest(context) {
  const url = new URL(context.request.url);

  url.protocol = 'https:';
  url.hostname = 'campuslnf-production.up.railway.app';
  url.port = '';

  const newHeaders = new Headers(context.request.headers);
  newHeaders.set('host', 'campuslnf-production.up.railway.app');

  const init = {
    method: context.request.method,
    headers: newHeaders,
    redirect: 'follow'
  };

  if (context.request.method !== 'GET' && context.request.method !== 'HEAD') {
    init.body = context.request.body;
    // In Cloudflare Workers, duplex is required when body is a ReadableStream
    init.duplex = 'half';
  }

  return fetch(url.toString(), init);
}
