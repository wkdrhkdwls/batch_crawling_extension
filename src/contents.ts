import type { Product } from "./interface/Crawling";
import { CoupangCrawler } from "./service/CoupangCrawling";
import { ElevenStCrawler } from "./service/ElevenstCrawling";

async function copyToClipboard(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    console.log("✅ 클립보드에 복사했습니다.");
  } catch (err) {
    console.warn("⚠️ Clipboard 실패", err);
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand("copy");
      console.log("✅ 클립보드에 복사했습니다.");
    } catch (e) {
      console.error("❌ 복사 실패:", e);
    }
    document.body.removeChild(ta);
  }
}

async function runCrawlAndCopy(overrideUrl?: string) {
  const url = overrideUrl ?? location.href;
  let domain: "coupang" | "11st" | null = null;
  if (url.includes("coupang.com")) {
    domain = "coupang";
  } else if (url.includes("11st.co.kr")) {
    domain = "11st";
  }
  if (!domain) return;

  const crawler =
    domain === "coupang" ? new CoupangCrawler(url) : new ElevenStCrawler(url);

  let result: Product;
  try {
    result = await crawler.crawl();
    console.log("👉 크롤링 결과:", result);
  } catch (e) {
    console.error("❌ 크롤링 실패:", e);
    return;
  }

  const payload = JSON.stringify(result, null, 2);
  await copyToClipboard(payload);
}

let lastUrl = location.href;

runCrawlAndCopy().catch(console.error);

setInterval(() => {
  if (location.href !== lastUrl) {
    lastUrl = location.href;
    console.log("🔄 URL 변경 감지:", lastUrl);
    runCrawlAndCopy(lastUrl).catch(console.error);
  }
}, 1000);

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "COPY_CRAWL_RESULT") {
    console.log("👉 재복사 대상 결과 ", lastUrl);
    runCrawlAndCopy(lastUrl).catch(console.error);
  }
});
