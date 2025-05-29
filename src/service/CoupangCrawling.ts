import type { ICrawler, Product } from "../interface/Crawling";

export class CoupangCrawler implements ICrawler {
  constructor(private readonly url: string) {}

  private static readonly PRODUCT_ID_RE = /\/vp\/products\/(\d+)/;
  private static readonly NON_DIGIT = /\D/g;

  async crawl(): Promise<Product> {
    const idMatch = CoupangCrawler.PRODUCT_ID_RE.exec(this.url);
    // 상품 ID
    const product_id = idMatch ? idMatch[1] : "";

    await this.waitForSelector(".prod-buy-header__title");

    // 상품명
    const titleEl = document.querySelector<HTMLElement>(
      ".prod-buy-header__title"
    );
    const title = titleEl?.textContent?.trim() ?? "";

    // 이미지
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

    // 상품 가격

    const rawPrice =
      document
        .querySelector<HTMLSpanElement>(".prod-price .total-price > strong")
        ?.textContent?.trim() ?? "";
    const price = Number(rawPrice.replace(CoupangCrawler.NON_DIGIT, "")) || 0;

    // 모델명
    const model_name = title.split(/\s+/)[0] ?? "";

    // 배송비
    const feeEl = document.querySelector<HTMLSpanElement>(".shipping-fee-txt");
    const feeText = feeEl?.textContent?.trim() ?? "";
    const shipping_fee = feeText.includes("무료배송")
      ? 0
      : Number(feeText.replace(CoupangCrawler.NON_DIGIT, "")) || 0;

    // 품절 여부
    const soldout = !!document.querySelector(".out-of-stock-badge");

    return {
      product_id,
      title,
      image,
      price,
      model_name,
      shipping_fee,
      return_fee: null,
      soldout,
    };
  }

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
        reject(new Error(`Selector ${selector} not found within ${timeout}ms`));
      }, timeout);
    });
  }
}
