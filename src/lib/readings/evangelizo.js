import "server-only";

import {
  isWithinEvangelizoWindow,
  toEvangelizoDate,
  toIsoDate,
  toUsccbReadingsUrl,
} from "./schema";

const EVANGELIZO_BASE = "http://feed.evangelizo.org/v2/reader.php";

/**
 * @param {string} xml
 * @param {string} tag
 * @returns {string}
 */
function extractCdata(xml, tag) {
  const re = new RegExp(`<${tag}><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tag}>`);
  const match = xml.match(re);
  return match?.[1]?.trim() || "";
}

/**
 * @param {string} xml
 * @returns {import('./schema').DailyReadings}
 */
export function parseEvangelizoXml(xml, isoDate) {
  const date = isoDate || extractCdata(xml, "date").replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3");

  /** @type {import('./schema').DailyReadingSection[]} */
  const readings = [];

  const firstText = extractCdata(xml, "reading_text1");
  if (firstText) {
    readings.push({
      title: "Reading 1",
      citation: extractCdata(xml, "reading_text1_st") || extractCdata(xml, "reading_text1_lt"),
      text: firstText,
    });
  }

  const psalmText = extractCdata(xml, "reading_text2");
  if (psalmText) {
    readings.push({
      title: "Responsorial Psalm",
      citation: extractCdata(xml, "reading_text2_st") || extractCdata(xml, "reading_text2_lt"),
      text: psalmText,
    });
  }

  const secondText = extractCdata(xml, "reading_text3");
  if (secondText) {
    readings.push({
      title: "Reading 2",
      citation: extractCdata(xml, "reading_text3_st") || extractCdata(xml, "reading_text3_lt"),
      text: secondText,
    });
  }

  const gospelText = extractCdata(xml, "reading_gospel");
  if (gospelText) {
    readings.push({
      title: "Gospel",
      citation: extractCdata(xml, "reading_gospel_st") || extractCdata(xml, "reading_gospel_lt"),
      text: gospelText,
    });
  }

  return {
    date: toIsoDate(date),
    liturgicalTitle: extractCdata(xml, "litugic_t"),
    saint: extractCdata(xml, "saint") || undefined,
    readings,
    usccbUrl: toUsccbReadingsUrl(toIsoDate(date)),
    commentary: extractCdata(xml, "comment") || undefined,
  };
}

/**
 * @param {string} [isoDate] - YYYY-MM-DD, defaults to today
 * @returns {Promise<import('./schema').DailyReadings>}
 */
export async function fetchDailyReadings(isoDate) {
  const date = toIsoDate(isoDate);

  if (!isWithinEvangelizoWindow(date)) {
    throw new Error("Readings are only available within 30 days of today.");
  }

  const params = new URLSearchParams({
    date: toEvangelizoDate(date),
    type: "xml",
    lang: "AM",
  });

  const response = await fetch(`${EVANGELIZO_BASE}?${params}`, {
    next: { revalidate: 3600 },
    headers: { Accept: "application/xml, text/xml, */*" },
  });

  if (!response.ok) {
    throw new Error(`Readings feed returned ${response.status} ${response.statusText}`);
  }

  const xml = await response.text();
  if (!xml.includes("<evangelizo>")) {
    throw new Error("Unexpected response from readings feed.");
  }

  return parseEvangelizoXml(xml, date);
}
