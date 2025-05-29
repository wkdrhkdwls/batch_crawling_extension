import { supabase } from "./utils/supabaseClient";
import type { NavErrorDetails, UrlRow } from "./interface/Database";
import { sleep } from "./utils/timeout";

const MAX_CONCURRENCY = 2; // 동시 탭 수
const CRAWL_TIMEOUT = 60_000; // 로딩 타임아웃(60초)
const NAV_RETRIES = 3; // 재시도 횟수
const NAV_DELAY = 3_000; // 재시도 전 대기(ms)
const MESSAGE_DELAY = 3_000; // 메시지 전송 전 대기(ms)
const BATCH_SIZE = 5; // 한 번에 가져올 URL 개수

/** 알림 띄우기 */
function notify(title: string, message: string) {
  chrome.notifications.create({
    type: "basic",
    iconUrl: "icons/crawl-128.png",
    title,
    message,
  });
}

/** 모든 대기 중인 URL을 배치 단위로 가져옴 */
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
    if (!data || data.length === 0) break;
    rows.push(...data);
    offset += BATCH_SIZE;
  }

  return rows;
}

/**
 * 탭이 'complete' 되면 true,
 * 에러/타임아웃 시 false
 */
function waitForLoad(tabId: number): Promise<boolean> {
  return new Promise((resolve) => {
    const tO = setTimeout(() => {
      cleanup();
      console.warn(`크롤 타임아웃 [tabId=${tabId}]`);
      resolve(false);
    }, CRAWL_TIMEOUT);

    const onErr = (d: NavErrorDetails) => {
      if (d.tabId !== tabId) return;
      cleanup();
      console.error(`네비게이션 오류 [tabId=${tabId}]: ${d.error}`);
      resolve(false);
    };
    chrome.webNavigation.onErrorOccurred.addListener(onErr);

    const onUpd = (_id: number, info: chrome.tabs.TabChangeInfo) => {
      if (_id === tabId && info.status === "complete") {
        cleanup();
        resolve(true);
      }
    };
    chrome.tabs.onUpdated.addListener(onUpd);

    function cleanup() {
      clearTimeout(tO);
      chrome.webNavigation.onErrorOccurred.removeListener(onErr);
      chrome.tabs.onUpdated.removeListener(onUpd);
    }
  });
}

/**
 * URL 내비게이션을 최대 retries번 재시도.
 * 성공 시 true, 모두 실패 시 false
 */
async function navigateWithRetry(
  tabId: number,
  url: string,
  retries = NAV_RETRIES
): Promise<boolean> {
  for (let i = 0; i <= retries; i++) {
    await new Promise<void>((r) =>
      chrome.tabs.update(tabId, { url }, () => {
        if (chrome.runtime.lastError) {
          console.warn(
            `tabs.update 실패 [${url}]: ${chrome.runtime.lastError.message}`
          );
        }
        r();
      })
    );
    const ok = await waitForLoad(tabId);
    if (ok) return true;
    console.warn(`→ 내비 재시도 #${i + 1} [${url}]`);
    await sleep(NAV_DELAY);
  }
  console.error(`→ 내비게이션 최종 실패, 건너뜁니다: ${url}`);
  return false;
}

/**
 * 워커: 하나의 탭을 열고 URL 리스트를 순차 처리 → 탭 닫기
 */
async function worker(urls: UrlRow[], idxRef: { current: number }) {
  const tab = await new Promise<chrome.tabs.Tab>((res) =>
    chrome.tabs.create({ url: "about:blank", active: false }, res)
  );
  const tabId = tab.id!;

  try {
    while (true) {
      const i = idxRef.current++;
      if (i >= urls.length) break;
      const row = urls[i];

      try {
        // 1) 내비게이션 + 재시도
        const ok = await navigateWithRetry(tabId, row.url);
        if (!ok) continue;

        // 2) 안정화 대기
        await sleep(MESSAGE_DELAY);

        // 3) 메시지 전송 & 응답
        const res: any = await new Promise((r) => {
          chrome.tabs.sendMessage(
            tabId,
            { type: "CRAWL_REQUEST", payload: { url: row.url } },
            (msg) => {
              if (chrome.runtime.lastError) {
                console.warn(
                  `sendMessage 실패 [${row.url}]: ${chrome.runtime.lastError.message}`
                );
                r(null);
              } else {
                r(msg);
              }
            }
          );
        });
        if (!res) {
          console.warn(`크롤 응답 없음 — 건너뜁니다: ${row.url}`);
          continue;
        }

        // 4) DB 저장
        if (res.success) {
          const { error } = await supabase.from("results").insert({
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
          if (error)
            console.error(`Result 저장 오류 (url_id=${row.id})`, error);
        } else {
          console.error(`크롤 실패 [${row.url}]`, res.error);
        }
      } catch (e) {
        console.error(`처리 중 에러 [${row.url}]`, e);
      }
    }
  } finally {
    chrome.tabs.remove(tabId);
  }
}

chrome.action.onClicked.addListener(async () => {
  try {
    // 시작 알림
    notify("크롤링 시작", "크롤링을 시작합니다");

    const urls = await fetchAllPendingUrls();
    if (urls.length === 0) {
      notify("크롤링 중단", "크롤링할 URL이 없습니다.");
      return;
    }

    // 인덱스 공유 객체
    const idxRef = { current: 0 };

    // 워커 풀 실행
    await Promise.all(
      Array.from({ length: MAX_CONCURRENCY }, () => worker(urls, idxRef))
    );

    // 완료 알림
    notify("크롤링 완료", "모든 페이지 크롤링 및 저장이 끝났습니다.");
    console.log("모든 크롤링 및 저장 완료");
  } catch (e) {
    console.error("배치 크롤링 오류", e);
    notify("크롤링 오류", (e as Error).message);
  }
});
