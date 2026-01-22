// Background Service Worker
// Currently minimal - can be extended for cross-tab features

chrome.runtime.onInstalled.addListener(() => {
  console.log('[NetView] Extension installed')
})

export {}
