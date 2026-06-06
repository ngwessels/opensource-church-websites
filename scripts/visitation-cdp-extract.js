// Injected into browser via CDP - scrapes eCatholic pages via same-origin fetch
async function scrapeVisitationPages(base, slugs) {
  const SKIP_NAMES = /^(mass times|confession times|today.?s readings|daily readings|calendar|news from the vatican|vatican news)$/i;
  const SKIP_CLASSES = /calendarModule|massTimesModule|readingsModule|vaticanNews/i;

  function absUrl(href, base) {
    if (!href) return '';
    if (href.startsWith('http')) return href;
    if (href.startsWith('//')) return 'https:' + href;
    return base + (href.startsWith('/') ? href : '/' + href);
  }

  function getPageTitle(doc) {
    const pt = doc.querySelector('#pageTitle h1, .pageTitle h1');
    if (pt) return pt.textContent.trim();
    for (const h of doc.querySelectorAll('#core h1')) {
      if (h.closest('#siteName, #header')) continue;
      const t = h.textContent.trim();
      if (t && t !== 'Visitation Parish') return t;
    }
    const t = doc.title.replace(/\s*[-–|]\s*Visitation Parish.*$/i, '').trim();
    return t || 'Home';
  }

  function cleanHtml(el) {
    const c = el.cloneNode(true);
    c.querySelectorAll('script,style,.editBar,.moveHandle,.moveHandleItem,.moduleControls,.sideTab,.adminOnly').forEach(n => n.remove());
    let html = c.innerHTML;
    html = html.replace(/\s*contenteditable="[^"]*"/gi, '');
    html = html.replace(/\s*(saveurl|deleteurl|editurl|addurl|savevalue|mode|data-cursor-ref)="[^"]*"/gi, '');
    return html.trim();
  }

  function moduleTitle(inner) {
    const el = inner.querySelector('.moduleTitle .editText, .moduleName .editText');
    const t = el ? el.textContent.trim() : '';
    return t === 'No Title' ? '' : t;
  }

  function shouldSkip(inner) {
    const title = moduleTitle(inner);
    if (SKIP_NAMES.test(title)) return true;
    if (SKIP_CLASSES.test(inner.className)) return true;
    return false;
  }

  function extractContentHtml(doc, base) {
    const parts = [];
    doc.querySelectorAll('#content1, #content2, #content3').forEach(region => {
      region.querySelectorAll(':scope > li[id^="module_"]').forEach(mod => {
        const inner = mod.querySelector('.moduleInner');
        if (!inner || shouldSkip(inner)) return;
        if (inner.classList.contains('peopleModule')) return;
        if (inner.classList.contains('linksModule') || inner.classList.contains('buttonModule')) return;
        if (inner.classList.contains('photoAlbumsModule')) return;
        if (inner.classList.contains('imageModule')) return;
        if (inner.classList.contains('vimeoModule') || inner.classList.contains('youtubeModule')) return;

        const title = moduleTitle(inner);
        const hidden = inner.classList.contains('moduleTitleHidden');

        const body = inner.querySelector('.moduleBody, .customText, .formattedText, .fr-view');
        if (body) {
          const html = cleanHtml(body);
          if (html.length > 15) {
            if (title && !hidden) parts.push('<h2>' + title + '</h2>');
            parts.push(html);
          }
        }
      });
    });
    return parts.join('\n');
  }

  function extractPeople(doc) {
    const people = [];
    doc.querySelectorAll('.peopleModule .person').forEach(p => {
      const name = (p.querySelector('.name span') || p.querySelector('.name'))?.textContent?.trim() || '';
      const role = p.querySelector('.role')?.textContent?.trim() || '';
      const lm = p.querySelector('.localMail')?.textContent || '';
      const dm = p.querySelector('.domainMail')?.textContent || '';
      let email = lm && dm ? lm + '@' + dm : '';
      if (!email) {
        const m = p.querySelector('a[href^="mailto:"]');
        email = m ? m.getAttribute('href').replace('mailto:', '') : '';
      }
      const phone = p.querySelector('.phone')?.textContent?.trim() || '';
      if (name) people.push({ name, role, email, phone });
    });
    return people;
  }

  function extractDocuments(doc, base) {
    const docs = [], seen = new Set();
    doc.querySelectorAll('#content1 a[href], #content2 a[href], #content3 a[href]').forEach(a => {
      const href = a.getAttribute('href') || '';
      if (!/\.pdf($|\?|#)/i.test(href) && !href.includes('/documents/')) return;
      const url = absUrl(href, base);
      if (!seen.has(url)) {
        seen.add(url);
        docs.push({ label: a.textContent.trim() || url.split('/').pop(), url });
      }
    });
    return docs;
  }

  function extractImages(doc, base) {
    const images = [], seen = new Set();
    doc.querySelectorAll('#content1 img, #content2 img, #content3 img').forEach(img => {
      if (img.closest('.thumb, .peopleModule, #featureSlideshow')) return;
      let src = img.getAttribute('src') || img.getAttribute('data-src') || '';
      if (!src || /spacer|blank\.gif/i.test(src)) return;
      src = absUrl(src, base);
      if (!seen.has(src)) {
        seen.add(src);
        images.push({ src, alt: img.getAttribute('alt') || '' });
      }
    });
    return images;
  }

  function extractVideos(doc, base) {
    const videos = [], seen = new Set();
    doc.querySelectorAll('iframe, embed, [data-vimeo-id], [data-youtube-id]').forEach(el => {
      let src = el.getAttribute('src') || el.getAttribute('data-src') || '';
      if (!src && el.dataset.vimeoId) src = 'https://player.vimeo.com/video/' + el.dataset.vimeoId;
      if (!src && el.dataset.youtubeId) src = 'https://www.youtube.com/embed/' + el.dataset.youtubeId;
      if (/youtube|vimeo|youtu\.be/i.test(src) && !seen.has(src)) {
        seen.add(src);
        videos.push({ url: absUrl(src, base) });
      }
    });
    doc.querySelectorAll('#content1 a[href], #content2 a[href], #content3 a[href]').forEach(a => {
      const href = a.getAttribute('href') || '';
      if (/youtube|vimeo|youtu\.be/i.test(href)) {
        const url = absUrl(href, base);
        if (!seen.has(url)) { seen.add(url); videos.push({ url }); }
      }
    });
    return videos;
  }

  function extractGalleries(doc, base) {
    const galleries = [], seen = new Set();
    const add = (src, alt) => {
      if (!src || seen.has(src)) return;
      seen.add(src);
      galleries.push({ src, alt: alt || '' });
    };
    doc.querySelectorAll('.photoAlbumModule a[href], .photoAlbumsModule a[href], .aggregate .photo a[href]').forEach(a => {
      let href = a.getAttribute('href') || '';
      if (!/pictures|\.(jpg|jpeg|png|gif|webp)/i.test(href)) return;
      href = absUrl(href, base).replace(/pictures-thumb/g, 'pictures');
      add(href, a.querySelector('img')?.getAttribute('alt'));
    });
    doc.querySelectorAll('.photoAlbumModule img, .photoAlbumsModule img, .aggregate .photo img, .photoAlbum img').forEach(img => {
      let src = img.getAttribute('src') || '';
      src = absUrl(src, base).replace(/pictures-thumb/g, 'pictures');
      add(src, img.getAttribute('alt'));
    });
    return galleries;
  }

  function slugFromPath(path) {
    return path === '/' ? 'home' : path.replace(/^\//, '');
  }

  const output = [];
  for (const path of slugs) {
    try {
      const res = await fetch(base + path);
      const html = await res.text();
      if (html.includes('Just a moment')) {
        output.push({ slug: slugFromPath(path), title: 'CLOUDFLARE_BLOCKED', html: '', people: [], documents: [], images: [], videos: [], galleries: [] });
        continue;
      }
      const doc = new DOMParser().parseFromString(html, 'text/html');
      output.push({
        slug: slugFromPath(path),
        title: getPageTitle(doc),
        html: extractContentHtml(doc, base),
        people: extractPeople(doc),
        documents: extractDocuments(doc, base),
        images: extractImages(doc, base),
        videos: extractVideos(doc, base),
        galleries: extractGalleries(doc, base),
      });
    } catch (e) {
      output.push({ slug: slugFromPath(path), title: 'ERROR', html: '', people: [], documents: [], images: [], videos: [], galleries: [], error: e.message });
    }
  }
  return output;
}
