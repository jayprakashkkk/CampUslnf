export async function onRequest(context) {
  const url = new URL(context.request.url);

  url.protocol = 'https:';
  url.hostname = 'campuslnf-production.up.railway.app';
  url.port = '';

  return fetch(new Request(url, context.request));
}
