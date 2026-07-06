/**
 * 简历快投助手 - Popup（简化版）
 * 仅作为开关入口，控制 content script 注入的浮动面板显隐
 */

document.addEventListener('DOMContentLoaded', async () => {
  const toggle = document.getElementById('toggle-panel');
  const optionsLink = document.getElementById('btn-open-options');

  // 查询当前面板状态
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab) {
    try {
      const response = await chrome.tabs.sendMessage(tab.id, { action: 'getStatus' });
      if (response) {
        toggle.checked = response.visible;
      }
    } catch (e) {
      // content script 可能未注入
      toggle.checked = false;
    }
  }

  // 切换开关
  toggle.addEventListener('change', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) return;

    const action = toggle.checked ? 'show' : 'hide';

    try {
      await chrome.tabs.sendMessage(tab.id, { action });
    } catch (e) {
      // content script 未注入，尝试动态注入
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content/content.js']
        });
        await chrome.scripting.insertCSS({
          target: { tabId: tab.id },
          files: ['content/content.css']
        });
        // 注入后等一小段时间再发送消息
        setTimeout(async () => {
          try {
            await chrome.tabs.sendMessage(tab.id, { action: 'show' });
            toggle.checked = true;
          } catch (err) {
            console.error('[简历快投助手] 注入后仍无法通信:', err);
            toggle.checked = false;
          }
        }, 300);
      } catch (err) {
        console.error('[简历快投助手] 注入失败:', err);
        toggle.checked = false;
      }
    }
  });

  // 打开设置页面
  optionsLink.addEventListener('click', (e) => {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
  });
});
