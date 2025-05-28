// background.ts

import { supabase } from "./utils/supabaseClient";
import type { UrlRow } from "./interface/Database";

async function fetchPendingUrls(): Promise<UrlRow[]> {
  const { data, error } = await supabase
    .from("urls")
    .select("id, domain, url, name")
    .limit(10);
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

async function crawlAndSave(row: UrlRow): Promise<void> {
  return new Promise((resolve) => {
    chrome.tabs.create({ url: row.url, active: false }, async (tab) => {
      if (!tab.id) {
        return resolve();
      }

      // 1) contents.js를 프로그래매틱하게 주입
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["contents.js"],
      });

      // 2) 페이지가 완전히 로드된 후 메시지 보내기
      const listener = (
        tabId: number,
        changeInfo: chrome.tabs.TabChangeInfo
      ) => {
        if (tabId === tab.id && changeInfo.status === "complete") {
          chrome.tabs.onUpdated.removeListener(listener);

          chrome.tabs.sendMessage(
            tabId,
            { type: "CRAWL_REQUEST", payload: { url: row.url } },
            async (res) => {
              if (res?.success) {
                await saveResult(row.id, res.result);
              } else {
                console.error(`크롤 실패 [${row.url}]`, res?.error);
              }
              chrome.tabs.remove(tabId);
              resolve();
            }
          );
        }
      };
      chrome.tabs.onUpdated.addListener(listener);
    });
  });
}

chrome.action.onClicked.addListener(async () => {
  try {
    const urls = await fetchPendingUrls();
    if (urls.length === 0) {
      console.log("처리할 URL이 없습니다.");
      return;
    }
    await Promise.all(urls.map(crawlAndSave));
    console.log("모든 크롤링 및 저장 완료");
  } catch (e) {
    console.error("배치 크롤링 오류", e);
  }
});
