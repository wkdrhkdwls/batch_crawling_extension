import type { Product } from "./interface/Crawling";
import { CoupangCrawler } from "./service/CoupangCrawling";
import { ElevenStCrawler } from "./service/ElevenstCrawling";

async function crawlProduct(url: string): Promise<Product> {
  const domain = url.includes("coupang.com")
    ? "coupang"
    : url.includes("11st.co.kr")
    ? "11st"
    : null;

  if (!domain) {
    throw new Error("지원하지 않는 도메인입니다");
  }

  const crawler =
    domain === "coupang" ? new CoupangCrawler(url) : new ElevenStCrawler(url);

  return crawler.crawl();
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === "CRAWL_REQUEST" && typeof msg.payload?.url === "string") {
    crawlProduct(msg.payload.url)
      .then((result) => {
        sendResponse({ success: true, result });
      })
      .catch((error) => {
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }
});
