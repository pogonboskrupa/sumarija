// ========== Cloudflare Worker - CORS Proxy ==========
// Ovaj Worker prosljeđuje sve zahtjeve na Google Apps Script
// i automatski dodaje CORS header-e kako bi frontend mogao komunicirati sa backend-om

// 🔧 KONFIGURIŠI OVAJ URL SA SVOJIM APPS SCRIPT DEPLOYMENT URL-om
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycby1ex5OXfAJy651uBTdyGXW3TBzeJ2rB43xtQOXjBwlrfXsQF1UuRBuXaghDRzGhbeC/exec';

// 🌐 CORS konfiguriši dozvoljene domene (ili '*' za sve)
const ALLOWED_ORIGINS = [
  'https://pogonboskrupa.github.io',
  'http://localhost:5500',  // Za lokalni development
  'http://127.0.0.1:5500'   // Za lokalni development
];

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  const origin = request.headers.get('Origin');

  // Provjeri da li je origin dozvoljen
  const allowOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];

  // CORS Headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400', // 24 sata cache za preflight
  };

  // Handle OPTIONS preflight request
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders
    });
  }

  try {
    // Konstruiši URL sa query parametrima
    const url = new URL(request.url);
    const appsScriptUrl = APPS_SCRIPT_URL + url.search;

    console.log(`[Proxy] Forwarding ${request.method} request to Apps Script`);
    console.log(`[Proxy] URL: ${appsScriptUrl}`);

    // Prosljeđivanje zahtjeva na Apps Script
    const appsScriptRequest = new Request(appsScriptUrl, {
      method: request.method,
      headers: {
        'Content-Type': 'application/json',
      },
      body: request.method !== 'GET' && request.method !== 'HEAD'
        ? await request.text()
        : undefined
    });

    // Pozovi Apps Script
    const response = await fetch(appsScriptRequest);

    // Pročitaj response body
    const responseBody = await response.text();

    console.log(`[Proxy] Apps Script responded with status: ${response.status}`);

    // Kreiraj novi response sa CORS header-ima
    const newResponse = new Response(responseBody, {
      status: response.status,
      statusText: response.statusText,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'X-Proxied-By': 'Cloudflare-Worker',
        'X-Apps-Script-Response': 'true'
      }
    });

    return newResponse;

  } catch (error) {
    console.error('[Proxy] Error:', error);

    // Vrati error response sa CORS header-ima
    return new Response(JSON.stringify({
      success: false,
      error: 'Proxy error: ' + error.message,
      details: error.toString()
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
}

// ========== TEST ENDPOINT (opciono) ==========
// Dodaj ?test=true na Worker URL da provjeriš da li radi
addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  if (url.searchParams.get('test') === 'true') {
    event.respondWith(new Response(JSON.stringify({
      success: true,
      message: '✅ Cloudflare Worker radi!',
      timestamp: new Date().toISOString(),
      workerVersion: '1.0.0',
      appsScriptTarget: APPS_SCRIPT_URL
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    }));
  }
});
