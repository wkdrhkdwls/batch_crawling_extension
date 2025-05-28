// src/service/CoupangCrawler.ts
import type { ICrawler, Product, Domain } from "../interface/Crawling";

export class CoupangCrawler implements ICrawler {
  constructor(private readonly url: string) {}

  private static readonly PRODUCT_ID_RE = /\/vp\/products\/(\d+)/;
  private static readonly NON_DIGIT = /\D/g;

  async crawl(): Promise<Product> {
    // 1) product_id 추출
    const idMatch = CoupangCrawler.PRODUCT_ID_RE.exec(this.url);
    const product_id = idMatch?.[1] ?? "";

    // 2) 페이지가 로드될 때까지 대기
    await this.waitForSelector(".prod-buy-header__title");

    // 3) title
    const title =
      document
        .querySelector<HTMLElement>(".prod-buy-header__title")
        ?.textContent?.trim() ?? "";

    // 4) image
    const imgEl = document.querySelector<HTMLImageElement>(
      ".prod-image-container .prod-image__item--active img"
    );
    let image = "";
    if (imgEl) {
      if (imgEl.src && !/no_img/.test(imgEl.src)) {
        image = imgEl.src;
      } else if (imgEl.dataset.src) {
        const ds = imgEl.dataset.src;
        image = ds.startsWith("//") ? `https:${ds}` : ds;
      }
    }

    // 5) price
    const rawPrice =
      document
        .querySelector<HTMLSpanElement>(
          ".prod-sale-price .total-price > strong"
        )
        ?.textContent?.trim() ?? "";
    const price = Number(rawPrice.replace(CoupangCrawler.NON_DIGIT, "")) || 0;

    // 6) model_name (제목의 첫 단어)
    const model_name = title.split(/\s+/)[0] ?? "";

    // 7) shipping_fee
    const feeText =
      document
        .querySelector<HTMLSpanElement>(".shipping-fee-txt")
        ?.textContent?.trim() ?? "";
    const shipping_fee = feeText.includes("무료배송")
      ? 0
      : Number(feeText.replace(CoupangCrawler.NON_DIGIT, "")) || 0;

    // 8) return_fee (쿠팡은 보통 반품비가 없으므로 0으로 고정)
    const return_fee = 0;

    // 9) soldout 여부
    const soldout = !!document.querySelector(".out-of-stock-badge");

    // 10) domain
    const hostname = new URL(this.url).hostname.replace(/^www\./, "");
    const domain = (hostname.split(".")[0] as Domain) ?? "coupang";

    return {
      product_id,
      title,
      image,
      price,
      model_name,
      shipping_fee,
      return_fee,
      soldout,
      domain,
    };
  }

  /** selector가 나올 때까지 최대 timeout(ms) 동안 대기 */
  private waitForSelector(selector: string, timeout = 10_000): Promise<void> {
    return new Promise((resolve, reject) => {
      if (document.querySelector(selector)) return resolve();

      const observer = new MutationObserver((_, obs) => {
        if (document.querySelector(selector)) {
          obs.disconnect();
          resolve();
        }
      });
      observer.observe(document.documentElement, {
        childList: true,
        subtree: true,
      });

      setTimeout(() => {
        observer.disconnect();
        reject(
          new Error(`Selector "${selector}" not found within ${timeout}ms`)
        );
      }, timeout);
    });
  }
}
