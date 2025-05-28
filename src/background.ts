console.log("🔌 background service worker loaded");

chrome.action.onClicked.addListener((tab) => {
  if (tab.id !== undefined) {
    chrome.tabs.sendMessage(tab.id, { type: "COPY_CRAWL_RESULT" });
  }
});
