#!/usr/bin/env node
/**
 * Playwright scraper for visitationfg.org CMS migration.
 * Extraction logic mirrors browser MCP CDP inspection of eCatholic DOM.
 */
import { chromium } from 'playwright';
import { writeFileSync } from 'fs';

const BASE = 'https://www.visitationfg.org';
const SLUGS = [
  '/',
  '/church-audio',
  '/about-us',
  '/staff',
  '/new-parishioner-form',
  '/parish-history',
  '/the-visitation',
  '/live-streaming',
  '/baptism',
  '/reconciliation',
  '/first-holy-communion',
  '/confirmation',
  '/marriage',
  '/anointing-of-the-sick',
  '/holy-orders',
  '/altar-society',
  '/formed',
  '/high-school-youth-group',
  '/liturgical-ministers',
  '/middle-school-youth-group',
  '/music-choirs',
  '/ocia',
  '/religious-ed-sacramental-prep',
  '/shalom-world-tv',
  '/altar-server',
  '/parish-picnic',
  '/school-auction',
  '/administrative-finance-council',
  '/cyo',
  '/knights-of-columbus',
  '/pastoral-council',
  '/calendar-1',
  '/giving',
  '/scrip-program',
  '/photoalbums/prayer-to-the-sacred-heard',
  '/photoalbums/mission-renewal-prayer',
  '/photoalbums/pumpkin-carning',
];

const EXTRACT_FN = () => {
  const SKIP_MODULE_PATTERNS = [
    /mass\s*times/i, /confession\s*times/i, /today.?s\s*readings/i,
    /daily\s*readings/i, /^calendar$/i, /news\s*from\s*the\s*vatican/i,
    /vatican\s*news/i, /featureSlideshow/i,
  ];

  function shouldSkipModule(el) {
    const moduleName = el.querySelector('.moduleName .moduleTitle .editText, .moduleName .editText, h2.moduleName')?.textContent?.trim() || '';
    const cls = el.className || '';
    const id = el.id || '';
    const combined = `${cls} ${id} ${moduleName}`;
    return SKIP_MODULE_PATTERNS.some((p) => p.test(combined));
  }

  function getPageTitle(doc) {
    const pageTitle = doc.querySelector('#pageTitle h1, .pageTitle h1');
    if (pageTitle) return pageTitle.textContent.trim();
    const h1s = [...doc.querySelectorAll('#core h1')];
    for (const h of h1s) {
      if (h.closest('#siteName, #header')) continue;
      const t = h.textContent.trim();
      if (t && t !== 'Visitation Parish') return t;
    }
    const title = doc.title.replace(/\s*[-–|]\s*Visitation Parish.*$/i, '').trim();
    return title || 'Home';
  }

  function cleanHtml(el) {
    const clone = el.cloneNode(true);
    clone.querySelectorAll('script, style, .editBar, .moveHandle, .moveHandleItem, .moduleControls, [contenteditable]').forEach((n) => n.remove());
    clone.querySelectorAll('[saveurl], [deleteurl], [editurl], [addurl]').forEach((n) => {
      if (n.tagName === 'SPAN' && n.classList.contains('editText')) {
        n.removeAttribute('contenteditable');
        n.removeAttribute('saveurl');
        n.removeAttribute('savevalue');
      }
    });
    return clone.innerHTML.replace(/\s+/g, ' ').trim();
  }

  function extractContentHtml(doc) {
    const parts = [];
    const regions = doc.querySelectorAll('#content1, #content2, #content3');

    regions.forEach((region) => {
      region.querySelectorAll(':scope > li[id^="module_"]').forEach((mod) => {
        if (shouldSkipModule(mod)) return;
        const inner = mod.querySelector('.moduleInner');
        if (!inner) return;

        if (inner.classList.contains('peopleModule')) return;

        const moduleTitleEl = inner.querySelector('.moduleTitle .editText, .moduleName .editText');
        const moduleTitle = moduleTitleEl?.textContent?.trim() || '';
        const isTitleHidden = inner.classList.contains('moduleTitleHidden');

        const customText = inner.querySelector('.customText, .formattedText, .fr-view');
        const moduleBody = inner.querySelector('.moduleBody');

        if (customText) {
          const html = cleanHtml(customText);
          if (html && html.length > 10) {
            if (moduleTitle && !isTitleHidden) parts.push(`<h2>${moduleTitle}</h2>`);
            parts.push(html);
          }
        } else if (moduleBody && !inner.querySelector('.photoAlbum, .calendarModule, .massTimesModule, .readingsModule')) {
          const clone = moduleBody.cloneNode(true);
          clone.querySelectorAll('.aggregate > li.photo, .photoAlbum, .linkModule').forEach((n) => {
            if (n.classList.contains('photo') || n.closest('.photoAlbum')) return;
          });
          const html = cleanHtml(clone);
          if (html && html.length > 20) {
            if (moduleTitle && !isTitleHidden) parts.push(`<h2>${moduleTitle}</h2>`);
            parts.push(html);
          }
        } else {
          const textEl = inner.querySelector('.editable:not(.peopleModule)');
          if (textEl) {
            const html = cleanHtml(textEl);
            if (html && html.length > 30 && !html.includes('editBar')) {
              if (moduleTitle && !isTitleHidden) parts.push(`<h2>${moduleTitle}</h2>`);
              parts.push(html);
            }
          }
        }
      });
    });

    return parts.join('\n').replace(/<h2>\s*<\/h2>/g, '');
  }

  function extractPeople(doc) {
    const people = [];
    doc.querySelectorAll('.peopleModule .person').forEach((person) => {
      const name = person.querySelector('.name span, .name')?.textContent?.trim() || '';
      const role = person.querySelector('.role')?.textContent?.trim() || '';
      const localMail = person.querySelector('.localMail')?.textContent || '';
      const domainMail = person.querySelector('.domainMail')?.textContent || '';
      const email = localMail && domainMail ? `${localMail}@${domainMail}` : person.querySelector('a[href^="mailto:"]')?.href?.replace('mailto:', '') || '';
      const phone = person.querySelector('.phone')?.textContent?.trim() || '';
      const photo = person.querySelector('img.thumbImage, img')?.src || '';
      if (name) people.push({ name, role, email, phone, photo });
    });
    return people;
  }

  function extractDocuments(doc) {
    const docs = [];
    const seen = new Set();
    doc.querySelectorAll('#content1 a[href], #content2 a[href], #content3 a[href]').forEach((a) => {
      const href = a.getAttribute('href') || '';
      if (!href.match(/\.pdf($|\?)/i) && !href.includes('/documents/') && !href.includes('/pictures/')) return;
      if (!href.match(/\.pdf/i) && !href.includes('/documents/')) return;
      const fullUrl = href.startsWith('http') ? href : `https://www.visitationfg.org${href}`;
      const label = a.textContent.trim() || a.getAttribute('title') || fullUrl.split('/').pop();
      const key = fullUrl;
      if (!seen.has(key)) {
        seen.add(key);
        docs.push({ label, url: fullUrl });
      }
    });
    return docs;
  }

  function extractImages(doc) {
    const images = [];
    const seen = new Set();
    doc.querySelectorAll('#content1 img, #content2 img, #content3 img').forEach((img) => {
      if (img.closest('#header, #nav, #footer, #featureSlideshow, .thumb')) return;
      const src = img.getAttribute('src') || img.getAttribute('data-src') || '';
      if (!src || src.includes('spacer') || src.includes('blank.gif') || src.includes('thumb')) return;
      const alt = img.getAttribute('alt') || '';
      if (!seen.has(src)) {
        seen.add(src);
        images.push({ src, alt });
      }
    });
    return images;
  }

  function extractVideos(doc) {
    const videos = [];
    const seen = new Set();
    doc.querySelectorAll('#content1 iframe, #content2 iframe, #content3 iframe, #content1 embed, #content2 embed').forEach((el) => {
      const src = el.getAttribute('src') || el.getAttribute('data-src') || '';
      if (!src.match(/youtube|vimeo|youtu\.be/i)) return;
      if (!seen.has(src)) {
        seen.add(src);
        videos.push({ url: src });
      }
    });
    doc.querySelectorAll('#content1 a[href], #content2 a[href], #content3 a[href]').forEach((a) => {
      const href = a.getAttribute('href') || '';
      if (href.match(/youtube|vimeo|youtu\.be/i) && !seen.has(href)) {
        seen.add(href);
        videos.push({ url: href });
      }
    });
    return videos;
  }

  function extractGalleries(doc) {
    const galleries = [];
    const seen = new Set();
    doc.querySelectorAll('.photoAlbumModule img, .photoAlbum img, [class*="photoAlbum"] img, .aggregate .photo img').forEach((img) => {
      let src = img.getAttribute('src') || img.getAttribute('data-src') || '';
      if (src.includes('thumb')) {
        src = src.replace(/pictures-thumb/g, 'pictures').replace(/-thumb/g, '');
      }
      const parent = img.closest('a');
      if (parent?.href && parent.href.match(/\.(jpg|jpeg|png|gif|webp)/i)) {
        src = parent.href;
      }
      if (!src || seen.has(src)) return;
      seen.add(src);
      galleries.push({ src, alt: img.getAttribute('alt') || '' });
    });
    doc.querySelectorAll('.photoAlbumModule a[href], .aggregate .photo a[href]').forEach((a) => {
      const href = a.getAttribute('href') || '';
      if (href.match(/\.(jpg|jpeg|png|gif|webp)/i) && !seen.has(href)) {
        seen.add(href);
        galleries.push({ src: href.startsWith('http') ? href : `https://www.visitationfg.org${href}`, alt: a.querySelector('img')?.alt || '' });
      }
    });
    return galleries;
  }

  return { getPageTitle, extractContentHtml, extractPeople, extractDocuments, extractImages, extractVideos, extractGalleries };
};

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 });

  const results = await page.evaluate(async ({ base, slugs }) => {
    const SKIP_MODULE_PATTERNS = [
      /mass\s*times/i, /confession\s*times/i, /today.?s\s*readings/i,
      /daily\s*readings/i, /^calendar$/i, /news\s*from\s*the\s*vatican/i,
      /vatican\s*news/i, /featureSlideshow/i,
    ];

    function shouldSkipModule(el) {
      const moduleName = el.querySelector('.moduleName .moduleTitle .editText, .moduleName .editText, h2.moduleName')?.textContent?.trim() || '';
      const cls = el.className || '';
      const id = el.id || '';
      return SKIP_MODULE_PATTERNS.some((p) => p.test(`${cls} ${id} ${moduleName}`));
    }

    function getPageTitle(doc) {
      const pageTitle = doc.querySelector('#pageTitle h1, .pageTitle h1');
      if (pageTitle) return pageTitle.textContent.trim();
      for (const h of doc.querySelectorAll('#core h1')) {
        if (h.closest('#siteName, #header')) continue;
        const t = h.textContent.trim();
        if (t && t !== 'Visitation Parish') return t;
      }
      return doc.title.replace(/\s*[-–|]\s*Visitation Parish.*$/i, '').trim() || 'Home';
    }

    function cleanHtml(el) {
      const clone = el.cloneNode(true);
      clone.querySelectorAll('script, style, .editBar, .moveHandle, .moveHandleItem, .moduleControls').forEach((n) => n.remove());
      return clone.innerHTML.replace(/\s+/g, ' ').trim();
    }

    function extractContentHtml(doc) {
      const parts = [];
      doc.querySelectorAll('#content1, #content2, #content3').forEach((region) => {
        region.querySelectorAll(':scope > li[id^="module_"]').forEach((mod) => {
          if (shouldSkipModule(mod)) return;
          const inner = mod.querySelector('.moduleInner');
          if (!inner || inner.classList.contains('peopleModule')) return;
          if (inner.querySelector('.calendarModule, .massTimesModule, .readingsModule, .photoAlbumModule, .linkModule, .buttonModule')) {
            if (!inner.querySelector('.customText, .formattedText, .fr-view')) return;
          }

          const moduleTitleEl = inner.querySelector('.moduleTitle .editText, .moduleName .editText');
          const moduleTitle = moduleTitleEl?.textContent?.trim() || '';
          const isTitleHidden = inner.classList.contains('moduleTitleHidden');
          const customText = inner.querySelector('.customText, .formattedText, .fr-view');

          if (customText) {
            const html = cleanHtml(customText);
            if (html && html.length > 10) {
              if (moduleTitle && !isTitleHidden) parts.push(`<h2>${moduleTitle}</h2>`);
              parts.push(html);
            }
          } else {
            const body = inner.querySelector('.moduleBody');
            if (body) {
              const html = cleanHtml(body);
              if (html && html.length > 20 && !body.querySelector('.person, .photoAlbum')) {
                if (moduleTitle && !isTitleHidden) parts.push(`<h2>${moduleTitle}</h2>`);
                parts.push(html);
              }
            }
          }
        });
      });
      return parts.join('\n');
    }

    function extractPeople(doc) {
      const people = [];
      doc.querySelectorAll('.peopleModule .person').forEach((person) => {
        const name = person.querySelector('.name span')?.textContent?.trim() || person.querySelector('.name')?.textContent?.trim() || '';
        const role = person.querySelector('.role')?.textContent?.trim() || '';
        const localMail = person.querySelector('.localMail')?.textContent || '';
        const domainMail = person.querySelector('.domainMail')?.textContent || '';
        const email = localMail && domainMail ? `${localMail}@${domainMail}` : '';
        const phone = person.querySelector('.phone')?.textContent?.trim() || '';
        const photo = person.querySelector('img')?.src || '';
        if (name) people.push({ name, role, email, phone, photo });
      });
      return people;
    }

    function extractDocuments(doc) {
      const docs = [];
      const seen = new Set();
      doc.querySelectorAll('#content1 a[href], #content2 a[href], #content3 a[href]').forEach((a) => {
        const href = a.getAttribute('href') || '';
        if (!href.match(/\.pdf($|\?|#)/i) && !href.includes('/documents/')) return;
        const fullUrl = href.startsWith('http') ? href : base + href;
        const label = a.textContent.trim() || fullUrl.split('/').pop();
        if (!seen.has(fullUrl)) { seen.add(fullUrl); docs.push({ label, url: fullUrl }); }
      });
      return docs;
    }

    function extractImages(doc) {
      const images = [];
      const seen = new Set();
      doc.querySelectorAll('#content1 img, #content2 img, #content3 img').forEach((img) => {
        if (img.closest('#header, #nav, #footer, #featureSlideshow, .thumb, .peopleModule')) return;
        const src = img.src || '';
        if (!src || src.includes('spacer') || src.includes('blank') || src.includes('thumb')) return;
        if (!seen.has(src)) { seen.add(src); images.push({ src, alt: img.alt || '' }); }
      });
      return images;
    }

    function extractVideos(doc) {
      const videos = [];
      const seen = new Set();
      doc.querySelectorAll('iframe, embed').forEach((el) => {
        const src = el.src || '';
        if (src.match(/youtube|vimeo|youtu\.be/i) && !seen.has(src)) { seen.add(src); videos.push({ url: src }); }
      });
      doc.querySelectorAll('#content1 a[href], #content2 a[href]').forEach((a) => {
        const href = a.href || '';
        if (href.match(/youtube|vimeo|youtu\.be/i) && !seen.has(href)) { seen.add(href); videos.push({ url: href }); }
      });
      return videos;
    }

    function extractGalleries(doc) {
      const galleries = [];
      const seen = new Set();
      doc.querySelectorAll('.photoAlbumModule a[href], .aggregate .photo a[href], .photoAlbum a[href]').forEach((a) => {
        let href = a.getAttribute('href') || '';
        if (!href.match(/\.(jpg|jpeg|png|gif|webp)|pictures/i)) return;
        if (!href.startsWith('http')) href = base + href;
        href = href.replace(/pictures-thumb/g, 'pictures');
        if (!seen.has(href)) { seen.add(href); galleries.push({ src: href, alt: a.querySelector('img')?.alt || '' }); }
      });
      doc.querySelectorAll('.photoAlbumModule img, .aggregate .photo img').forEach((img) => {
        let src = img.src || '';
        if (!src) return;
        src = src.replace(/pictures-thumb/g, 'pictures');
        if (!seen.has(src)) { seen.add(src); galleries.push({ src, alt: img.alt || '' }); }
      });
      return galleries;
    }

    function slugFromPath(path) {
      if (path === '/') return 'home';
      return path.replace(/^\//, '');
    }

    const output = [];
    for (const path of slugs) {
      try {
        const res = await fetch(base + path);
        const html = await res.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        output.push({
          slug: slugFromPath(path),
          title: getPageTitle(doc),
          html: extractContentHtml(doc),
          people: extractPeople(doc),
          documents: extractDocuments(doc),
          images: extractImages(doc),
          videos: extractVideos(doc),
          galleries: extractGalleries(doc),
        });
      } catch (e) {
        output.push({ slug: slugFromPath(path), error: e.message, title: '', html: '', people: [], documents: [], images: [], videos: [], galleries: [] });
      }
    }
    return output;
  }, { base: BASE, slugs: SLUGS });

  await browser.close();

  const outPath = new URL('../data/visitationfg-scrape.json', import.meta.url).pathname;
  writeFileSync(outPath, JSON.stringify(results, null, 2));
  console.log(`Wrote ${results.length} pages to ${outPath}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
