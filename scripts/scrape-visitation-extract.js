// Extraction function injected via browser CDP Runtime.evaluate
// Returns page data object for CMS migration
function extractPageData() {
  const SKIP_MODULE_PATTERNS = [
    /mass.?times/i, /confession.?times/i, /today.?s.?readings/i,
    /daily.?readings/i, /calendar/i, /news.?from.?the.?vatican/i,
    /vatican/i, /slideshow/i, /featureSlideshow/i
  ];

  const SKIP_SELECTORS = [
    '#header', '#nav', '#quickLinks', '#footer', '#adminToolbar', '#adminToolbarFooter',
    '#mobilePanel', '#mobileNavBar', '#siteName', '#sideTabHeader', '#sideTabNav', '#sideTabFooter',
    '.subNav', '#subNav', '.moduleNavigation', '.calendarModule', '.massTimesModule',
    '.readingsModule', '.dailyReadings', '.vaticanNews', '#featureSlideshow',
    'nav', 'footer', 'header'
  ];

  function shouldSkipModule(el) {
    const text = (el.textContent || '').substring(0, 200);
    const cls = el.className || '';
    const id = el.id || '';
    const combined = `${cls} ${id} ${text}`;
    return SKIP_MODULE_PATTERNS.some(p => p.test(combined));
  }

  function getPageTitle() {
    const pageTitle = document.querySelector('#pageTitle h1, .pageTitle h1, #core > .pageTitle h1');
    if (pageTitle) return pageTitle.textContent.trim();
    const h1s = [...document.querySelectorAll('#core h1, #content1 h1, #content2 h1')];
    const siteName = document.querySelector('#siteName h1');
    for (const h of h1s) {
      if (siteName && h === siteName.querySelector('h1')) continue;
      if (h.closest('#header')) continue;
      const t = h.textContent.trim();
      if (t && t !== 'Visitation Parish') return t;
    }
    const title = document.title.replace(/\s*[-|]\s*Visitation Parish.*$/i, '').trim();
    return title || 'Home';
  }

  function cleanHtml(el) {
    const clone = el.cloneNode(true);
    clone.querySelectorAll('script, style, .adminOnly, #adminToolbar, .editBar, .moduleControls').forEach(n => n.remove());
    return clone.innerHTML.trim();
  }

  function extractContentHtml() {
    const parts = [];
    const regions = document.querySelectorAll('#content1, #content2, #content3, #features');
    
    regions.forEach(region => {
      if (region.id === 'features') {
        const slideshow = region.querySelector('#featureSlideshow');
        if (slideshow) return;
      }
      const modules = region.querySelectorAll(':scope > li[id^="module_"]');
      modules.forEach(mod => {
        if (shouldSkipModule(mod)) return;
        const inner = mod.querySelector('.moduleInner, .customModule');
        if (!inner) return;

        const moduleName = inner.querySelector('.moduleName');
        const moduleTitle = moduleName ? moduleName.textContent.trim() : '';
        
        const contentAreas = inner.querySelectorAll('.customText, .formattedText, .moduleBody, .peopleModule, .documentModule, .linkModule, .buttonModule');
        
        if (contentAreas.length > 0) {
          contentAreas.forEach(area => {
            if (shouldSkipModule(area)) return;
            const html = cleanHtml(area);
            if (html) {
              if (moduleTitle && !html.includes(moduleTitle)) {
                parts.push(`<h2>${moduleTitle}</h2>`);
              }
              parts.push(html);
            }
          });
        } else {
          const editable = inner.querySelector('.editable, .fr-view, [class*="text"]');
          const target = editable || inner;
          const skipEls = target.querySelectorAll('.moduleName, .moduleSubtitle, .editBar');
          skipEls.forEach(e => e.remove());
          const html = cleanHtml(target);
          if (html && html.length > 20) {
            if (moduleTitle) parts.push(`<h2>${moduleTitle}</h2>`);
            parts.push(html);
          }
        }
      });
    });

    let html = parts.join('\n');
    html = html.replace(/<h2>\s*<\/h2>/g, '');
    return html;
  }

  function extractPeople() {
    const people = [];
    const peopleModules = document.querySelectorAll('.peopleModule, [class*="people"]');
    const staffItems = document.querySelectorAll('.peopleModule .person, .peopleModule li, .staffMember, .personModule');

    const items = staffItems.length > 0 ? staffItems : document.querySelectorAll('#content1 li[id^="module_"] .person, #content2 li[id^="module_"] .person');

    document.querySelectorAll('.peopleModule .person, .person').forEach(person => {
      const name = person.querySelector('.name, .personName, h3, h4, strong')?.textContent?.trim() || '';
      const role = person.querySelector('.title, .position, .role, .personTitle')?.textContent?.trim() || '';
      const emailEl = person.querySelector('a[href^="mailto:"]');
      const phoneEl = person.querySelector('a[href^="tel:"]');
      const email = emailEl ? emailEl.href.replace('mailto:', '') : '';
      const phone = phoneEl ? phoneEl.textContent.trim() : '';
      if (name) people.push({ name, role, email, phone });
    });

    if (people.length === 0) {
      document.querySelectorAll('#content1 .moduleInner, #content2 .moduleInner').forEach(mod => {
        mod.querySelectorAll('.person, [class*="staff"]').forEach(person => {
          const name = person.querySelector('h3, h4, .name, strong')?.textContent?.trim();
          if (!name) return;
          const role = person.querySelector('.title, .position')?.textContent?.trim() || '';
          const email = person.querySelector('a[href^="mailto:"]')?.href?.replace('mailto:', '') || '';
          const phone = person.querySelector('a[href^="tel:"]')?.textContent?.trim() || '';
          people.push({ name, role, email, phone });
        });
      });
    }

    return people;
  }

  function extractDocuments() {
    const docs = [];
    const seen = new Set();
    document.querySelectorAll('#content1 a[href], #content2 a[href], #content3 a[href]').forEach(a => {
      const href = a.href;
      if (!href.match(/\.pdf($|\?)/i) && !href.includes('/documents/') && !href.includes('/files/')) return;
      const label = a.textContent.trim() || a.getAttribute('title') || href.split('/').pop();
      const key = href + '|' + label;
      if (!seen.has(key)) {
        seen.add(key);
        docs.push({ label, url: href });
      }
    });
    return docs;
  }

  function extractImages() {
    const images = [];
    const seen = new Set();
    document.querySelectorAll('#content1 img, #content2 img, #content3 img').forEach(img => {
      if (img.closest('#header, #nav, #footer, #featureSlideshow')) return;
      let src = img.src || img.getAttribute('data-src') || '';
      if (!src || src.includes('spacer') || src.includes('blank.gif')) return;
      const alt = img.alt || '';
      if (!seen.has(src)) {
        seen.add(src);
        images.push({ src, alt });
      }
    });
    return images;
  }

  function extractVideos() {
    const videos = [];
    const seen = new Set();
    document.querySelectorAll('#content1 iframe, #content2 iframe, #content3 iframe, #content1 embed, #content2 embed').forEach(el => {
      const src = el.src || el.getAttribute('data-src') || '';
      if (!src.match(/youtube|vimeo|youtu\.be/i)) return;
      if (!seen.has(src)) {
        seen.add(src);
        videos.push({ url: src });
      }
    });
    document.querySelectorAll('#content1 a[href], #content2 a[href]').forEach(a => {
      const href = a.href;
      if (href.match(/youtube|vimeo|youtu\.be/i) && !seen.has(href)) {
        seen.add(href);
        videos.push({ url: href });
      }
    });
    return videos;
  }

  function extractGalleries() {
    const galleries = [];
    const seen = new Set();
    document.querySelectorAll('.photoAlbum img, .gallery img, .album img, [class*="photo"] img, .pswp img, a[href*="/photoalbums/"] img').forEach(img => {
      let src = img.src || img.closest('a')?.href || '';
      if (!src || seen.has(src)) return;
      if (src.includes('thumb') || src.match(/\.(jpg|jpeg|png|gif|webp)/i)) {
        seen.add(src);
        galleries.push({ src, alt: img.alt || '' });
      }
    });
    document.querySelectorAll('a[href*="/photoalbums/"] img, .photoAlbumModule img').forEach(img => {
      const src = img.src || img.getAttribute('data-src');
      if (src && !seen.has(src)) {
        seen.add(src);
        galleries.push({ src, alt: img.alt || '' });
      }
    });
    return galleries;
  }

  return {
    title: getPageTitle(),
    html: extractContentHtml(),
    people: extractPeople(),
    documents: extractDocuments(),
    images: extractImages(),
    videos: extractVideos(),
    galleries: extractGalleries()
  };
}
