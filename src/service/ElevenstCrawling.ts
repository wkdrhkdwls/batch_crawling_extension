import type { ICrawler, Product, Domain } from "../interface/Crawling";

export class ElevenStCrawler implements ICrawler {
  constructor(private readonly url: string) {}

  private static readonly PRODUCT_ID_RE = /\/products\/(\d+)/;
  private static readonly NON_DIGIT = /\D/g;

  async crawl(): Promise<Product> {
    const idMatch = ElevenStCrawler.PRODUCT_ID_RE.exec(this.url);
    const product_id = idMatch ? idMatch[1] : "";

    await this.waitForSelector(".c_product_info_title_coupon h1.title");

    // 상품명
    const titleEl = document.querySelector<HTMLElement>(
      ".c_product_info_title_coupon h1.title"
    );
    const title = titleEl?.textContent?.trim() ?? "";

    // 이미지
    const imgEl = document.querySelector<HTMLImageElement>(
      ".c_product_view_img img"
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

    // 최종 할인 가격
    const priceEl = document.querySelector<HTMLSpanElement>(
      "#finalDscPrcArea .price .value"
    );
    const rawPrice = priceEl?.textContent?.trim() ?? "";
    const price = Number(rawPrice.replace(ElevenStCrawler.NON_DIGIT, "")) || 0;

    // 모델명
    const model_name = title.split(/\s+/)[0] ?? "";

    // 배송비
    const feeEl = document.querySelector<HTMLElement>(".delivery dt");
    const feeText = feeEl?.textContent?.trim() ?? "";
    const shipping_fee = feeText.includes("무료배송")
      ? 0
      : Number(feeText.replace(ElevenStCrawler.NON_DIGIT, "")) || 0;

    // 품절 여부
    const soldout = !!document.querySelector(
      ".out-of-stock-badge, .sold-out, .oos-icon"
    );

    // 도메인
    const hostname = new URL(this.url).hostname.replace(/^www\./, "");
    const domain = hostname.split(".")[0] as Domain;

    return {
      product_id,
      title,
      image,
      price,
      model_name,
      shipping_fee,
      return_fee: null,
      soldout,
      domain,
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
