// background.ts

import { supabase } from "./utils/supabaseClient";
import type { UrlRow } from "./interface/Database";

const BATCH_SIZE = 10;
const CRAWL_TIMEOUT = 30_000; // 30초

/**
 * offset부터 BATCH_SIZE개씩 UrlRow를 가져옵니다.
 */
async function fetchPendingUrls(offset = 0): Promise<UrlRow[]> {
  const { data, error } = await supabase
    .from("urls")
    .select("id, domain, url, name")
    .order("id", { ascending: true })
    .range(offset, offset + BATCH_SIZE - 1);

  if (error) throw error;
  return data ?? [];
}

async function saveResult(urlId: number, payload: any) {
  const { error } = await supabase.from("results").insert({
    url_id: urlId,
    product_id: payload.product_id,
    title: payload.title,
    image: payload.image,
    price: payload.price,
    model_name: payload.model_name,
    shipping_fee: payload.shipping_fee,
    return_fee: payload.return_fee,
    soldout: payload.soldout,
    crawled_at: new Date().toISOString(),
  });
  if (error) console.error(`Result 저장 오류 (url_id=${urlId})`, error);
}

/**
 * 1개의 URL에 대해 탭 열고,
 * 로드 완료 후 contents.js 주입 → 메시지 → DB 저장 → 탭 닫기
 * 타임아웃 처리 포함
 */
function crawlAndSave(row: UrlRow): Promise<void> {
  return new Promise((resolve) => {
    chrome.tabs.create({ url: row.url, active: false }, (tab) => {
      if (!tab.id) return resolve();
      const tabId = tab.id;

      // 타임아웃: 일정 시간 내에 끝나지 않으면 강제 종료
      const timeoutId = setTimeout(() => {
        chrome.tabs.onUpdated.removeListener(onUpdated);
        chrome.tabs.remove(tabId);
        console.warn(`크롤 타임아웃 [${row.url}]`);
        resolve();
      }, CRAWL_TIMEOUT);

      // 탭이 완전히 로드됐을 때
      const onUpdated = (
        updatedTabId: number,
        changeInfo: chrome.tabs.TabChangeInfo
      ) => {
        if (updatedTabId !== tabId || changeInfo.status !== "complete") return;

        chrome.tabs.onUpdated.removeListener(onUpdated);
        clearTimeout(timeoutId);

        // 1) contents.js 인젝션
        chrome.scripting
          .executeScript({
            target: { tabId },
            files: ["contents.js"],
          })
          .then(() => {
            // 2) 메시지 보내서 크롤링 요청
            chrome.tabs.sendMessage(
              tabId,
              { type: "CRAWL_REQUEST", payload: { url: row.url } },
              async (res) => {
                try {
                  if (res?.success) {
                    await saveResult(row.id, res.result);
                  } else {
                    console.error(`크롤 실패 [${row.url}]`, res?.error);
                  }
                } catch (e) {
                  console.error(`saveResult 중 오류 [${row.url}]`, e);
                } finally {
                  chrome.tabs.remove(tabId);
                  resolve();
                }
              }
            );
          })
          .catch((err) => {
            console.error(`스크립트 주입 오류 [${row.url}]`, err);
            chrome.tabs.remove(tabId);
            resolve();
          });
      };

      chrome.tabs.onUpdated.addListener(onUpdated);
    });
  });
}

chrome.action.onClicked.addListener(async () => {
  try {
    let offset = 0;

    while (true) {
      const urls = await fetchPendingUrls(offset);
      if (urls.length === 0) break;

      // 병렬 처리 (10개씩)
      await Promise.all(urls.map(crawlAndSave));

      offset += BATCH_SIZE;
    }

    console.log("모든 크롤링 및 저장 완료");
  } catch (e) {
    console.error("배치 크롤링 오류", e);
  }
});
