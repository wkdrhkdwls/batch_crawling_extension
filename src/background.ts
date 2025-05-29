import { supabase } from "./utils/supabaseClient";
import type { UrlRow } from "./interface/Database";

const BATCH_SIZE = 10;
const CRAWL_TIMEOUT = 30_000;
const MAX_CONCURRENCY = 3;

async function fetchAllPendingUrls(): Promise<UrlRow[]> {
  let offset = 0;
  const rows: UrlRow[] = [];

  while (true) {
    const { data, error } = await supabase
      .from("urls")
      .select("id, domain, url, name")
      .order("id", { ascending: true })
      .range(offset, offset + BATCH_SIZE - 1);

    if (error) throw error;
    if (!data?.length) break;

    rows.push(...data);
    offset += BATCH_SIZE;
  }

  return rows;
}

function waitForLoad(tabId: number): Promise<void> {
  return new Promise((resolve) => {
    const timeoutId = setTimeout(() => {
      cleanup();
      console.warn(`크롤 타임아웃 [tabId=${tabId}]`);
      resolve();
    }, CRAWL_TIMEOUT);

    const onError = (details: { tabId: number; error: string }) => {
      if (details.tabId !== tabId) return;
      cleanup();
      console.error(`네비게이션 오류 [tabId=${tabId}]: ${details.error}`);
      resolve();
    };
    chrome.webNavigation.onErrorOccurred.addListener(onError);

    const onUpdated = (_tabId: number, info: chrome.tabs.TabChangeInfo) => {
      if (_tabId !== tabId || info.status !== "complete") return;
      cleanup();
      resolve();
    };
    chrome.tabs.onUpdated.addListener(onUpdated);

    function cleanup() {
      clearTimeout(timeoutId);
      chrome.webNavigation.onErrorOccurred.removeListener(onError);
      chrome.tabs.onUpdated.removeListener(onUpdated);
    }
  });
}

chrome.action.onClicked.addListener(async () => {
  try {
    const urls = await fetchAllPendingUrls();
    if (urls.length === 0) {
      console.log("크롤링할 URL이 없습니다.");
      return;
    }

    const newWin = await new Promise<chrome.windows.Window>(
      (resolve, reject) => {
        chrome.windows.create(
          {
            url: "about:blank",
            state: "minimized",
            focused: true,
          },
          (win) => {
            if (!win) {
              reject(new Error("새 창 생성에 실패했습니다."));
            } else {
              resolve(win);
            }
          }
        );
      }
    );
    const windowId = newWin.id!;

    const resultsToInsert: any[] = [];
    let currentIndex = 0;

    const worker = async () => {
      const first = urls[currentIndex];
      const tab = await new Promise<chrome.tabs.Tab>((resolve) =>
        chrome.tabs.create({ windowId, url: first.url, active: false }, resolve)
      );
      const tabId = tab.id!;

      while (true) {
        const idx = currentIndex++;
        if (idx >= urls.length) break;
        const row = urls[idx];

        await new Promise<void>((resolve) =>
          chrome.tabs.update(tabId, { url: row.url }, () => resolve())
        );

        await waitForLoad(tabId);

        const res = await new Promise<any>((resolve) =>
          chrome.tabs.sendMessage(
            tabId,
            { type: "CRAWL_REQUEST", payload: { url: row.url } },
            resolve
          )
        );

        if (res?.success) {
          resultsToInsert.push({
            url_id: row.id,
            product_id: res.result.product_id,
            title: res.result.title,
            image: res.result.image,
            price: res.result.price,
            model_name: res.result.model_name,
            shipping_fee: res.result.shipping_fee,
            return_fee: res.result.return_fee,
            soldout: res.result.soldout,
            crawled_at: new Date().toISOString(),
          });
        } else {
          console.error(`크롤 실패 [${row.url}]`, res?.error);
        }
      }

      chrome.tabs.remove(tabId);
    };

    await Promise.all(Array.from({ length: MAX_CONCURRENCY }, () => worker()));

    const { error } = await supabase.from("results").insert(resultsToInsert);
    if (error) console.error("Bulk insert 오류", error);

    console.log("모든 크롤링 및 저장 완료");
  } catch (e) {
    console.error("배치 크롤링 오류", e);
  }
});
