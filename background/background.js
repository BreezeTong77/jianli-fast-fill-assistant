/**
 * 简历快投助手 - Background Service Worker
 * 
 * 当前版本功能较少，主要预留以下扩展点：
 * 1. 跨 tab 通信的中转站
 * 2. 未来可能的右键菜单功能
 * 3. 未来可能的键盘快捷键支持
 */

// ============ 扩展安装/更新事件 ============
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('[简历快投助手] 扩展已安装');
    // 首次安装时，可以在这里打开设置页面引导用户
    // chrome.tabs.create({ url: chrome.runtime.getURL('options/options.html') });
  } else if (details.reason === 'update') {
    console.log('[简历快投助手] 扩展已更新到版本', chrome.runtime.getManifest().version);
  }
});

async function showPanelInTab(tab) {
  if (!tab || !tab.id) return;

  try {
    await chrome.tabs.sendMessage(tab.id, { action: 'show' });
    return;
  } catch (e) {
    // 当前页面可能还没有 content script，点击插件图标时再补注入一次。
  }

  try {
    await chrome.scripting.insertCSS({
      target: { tabId: tab.id },
      files: ['content/content.css']
    });
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content/content.js']
    });
    setTimeout(() => {
      chrome.tabs.sendMessage(tab.id, { action: 'show' }).catch((err) => {
        console.warn('[简历快投助手] 无法打开浮动面板:', err);
      });
    }, 150);
  } catch (err) {
    console.warn('[简历快投助手] 当前页面不支持注入浮动面板:', err);
  }
}

// 点击浏览器工具栏图标时，直接打开当前页面里的浮动面板。
chrome.action.onClicked.addListener((tab) => {
  showPanelInTab(tab);
});

// ============ 消息中转 ============
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'forwardToContent') {
    // 转发消息给指定 tab 的 content script
    chrome.tabs.sendMessage(message.tabId, message.payload, (response) => {
      sendResponse(response);
    });
    return true;
  }
  
  if (message.action === 'openOptions') {
    // 从 content script 打开设置页面
    chrome.runtime.openOptionsPage();
    sendResponse({ success: true });
    return true;
  }
});
