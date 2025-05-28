import type { ICrawler, Product, Domain } from "../interface/Crawling";

export class ElevenStCrawler implements ICrawler {
  constructor(private readonly url: string) {}

  private static readonly PRODUCT_ID_RE = /\/products\/(\d+)/;
  private static readonly NON_DIGIT = /\D/g;

  async crawl(): Promise<Product> {
    // 1) product_id 추출
    const idMatch = ElevenStCrawler.PRODUCT_ID_RE.exec(this.url);
    const product_id = idMatch?.[1] ?? "";

    // 2) 페이지 로드 대기
    await this.waitForSelector(".c_product_info_title_coupon h1.title");

    // 3) title
    const title =
      document
        .querySelector<HTMLElement>(".c_product_info_title_coupon h1.title")
        ?.textContent?.trim() ?? "";

    // 4) image
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

    // 5) price
    const rawPrice =
      document
        .querySelector<HTMLSpanElement>("#finalDscPrcArea .price .value")
        ?.textContent?.trim() ?? "";
    const price = Number(rawPrice.replace(ElevenStCrawler.NON_DIGIT, "")) || 0;

    // 6) model_name
    const model_name = title.split(/\s+/)[0] ?? "";

    // 7) shipping_fee
    const feeText =
      document
        .querySelector<HTMLElement>(".delivery dt")
        ?.textContent?.trim() ?? "";
    const shipping_fee = feeText.includes("무료배송")
      ? 0
      : Number(feeText.replace(ElevenStCrawler.NON_DIGIT, "")) || 0;

    // 8) soldout 여부
    const soldout = !!document.querySelector(
      ".out-of-stock-badge, .sold-out, .oos-icon"
    );

    // 9) domain (fallback 포함)
    const hostname = new URL(this.url).hostname.replace(/^www\./, "");
    const domain = (hostname.split(".")[0] as Domain) ?? "11st";

    return {
      product_id,
      title,
      image,
      price,
      model_name,
      shipping_fee,
      return_fee: 0,
      soldout,
      domain,
    };
  }

  /** selector가 나올 때까지 대기 */
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
