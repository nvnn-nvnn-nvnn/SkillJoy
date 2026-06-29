// ── Tracking pixels (v3, Phase 11) ──────────────────────────────────────────
// Injects a creator's Meta / TikTok / GA4 pixels on their public storefront +
// sales pages and fires a PageView. The main value is retargeting-audience
// building. NOTE: purchase-conversion attribution (the Purchase event / server
// Conversions API) is a follow-up — the buyer leaves the creator's pixel'd page
// for the app checkout, so conversions aren't captured here yet.

function injectScript(id, code, src) {
  if (document.getElementById(id)) return;
  const s = document.createElement('script');
  s.id = id;
  if (src) { s.src = src; s.async = true; } else { s.innerHTML = code; }
  document.head.appendChild(s);
}

/** Inject configured pixels once. `pixels` = { meta, tiktok, ga4 }. */
export function injectPixels(pixels) {
  if (!pixels || typeof window === 'undefined') return;

  // Meta (Facebook) Pixel
  if (pixels.meta) {
    injectScript('px-meta', `
      !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
      n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
      n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
      t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}
      (window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
      fbq('init','${pixels.meta}');fbq('track','PageView');`);
  }

  // TikTok Pixel
  if (pixels.tiktok) {
    injectScript('px-tiktok', `
      !function(w,d,t){w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];
      ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"];
      ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};
      for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);
      ttq.load=function(e,n){var i="https://analytics.tiktok.com/i18n/pixel/events.js";
      ttq._i=ttq._i||{};ttq._i[e]=[];ttq._i[e]._u=i;ttq._t=ttq._t||{};ttq._t[e]=+new Date;
      var o=d.createElement("script");o.type="text/javascript";o.async=!0;o.src=i+"?sdkid="+e;
      var a=d.getElementsByTagName("script")[0];a.parentNode.insertBefore(o,a)};
      ttq.load('${pixels.tiktok}');ttq.page();}(window,document,'ttq');`);
  }

  // Google Analytics 4
  if (pixels.ga4) {
    injectScript('px-ga4-src', null, `https://www.googletagmanager.com/gtag/js?id=${pixels.ga4}`);
    injectScript('px-ga4', `
      window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}
      gtag('js',new Date());gtag('config','${pixels.ga4}');`);
  }
}
