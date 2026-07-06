/**
 * 简历快投助手 - Content Script（页面注入脚本）
 * 
 * 核心功能：
 * 1. 注入一个可拖动、可拉伸的浮动侧边栏到页面右侧
 * 2. 浮动栏包含完整的简历字段管理 UI（分类标签 + 字段列表 + 粘贴按钮）
 * 3. 记录用户最后聚焦的输入框，支持一键粘贴
 * 4. 不会因为页面交互而自动隐藏
 * 
 * 通信：
 * - popup 发送 toggle/show/hide 消息控制浮层显隐
 * - 浮层内部直接操作页面 DOM 完成粘贴
 */

// ============ 全局状态 ============
/** 记录用户最后点击/聚焦的输入框 */
let lastFocusedElement = null;
/** 记录最近一次粘贴成功的网页输入框，用于把 Tab 焦点还给网页表单 */
let lastPastedElement = null;
/** 浮动面板是否已注入 */
let panelInjected = false;
/** 浮动面板是否可见 */
let panelVisible = false;
/** 面板 DOM 引用 */
let panelEl = null;
/** 当前选中的分类 ID */
let currentCategoryId = null;
/** 应用数据 */
let appData = {
  categories: [],
  settings: {
    collapsed: false,
    panelPosition: { right: 20, top: 80 },
    panelSize: { width: 340, height: null } // height=null 表示自适应
  }
};
/** 用于标记自身保存操作，避免 onChanged 触发 UI 重建 */
let _selfSaveTime = 0;

// ============ 默认数据（首次安装时写入） ============
const DEFAULT_DATA = {
  categories: [
    {
      id: 'cat_1',
      name: '基本信息',
      fields: [
        { id: 'f_1_1', title: '姓名', value: '张三', type: 'text' },
        { id: 'f_1_2', title: '性别', value: '男', type: 'text' },
        { id: 'f_1_3', title: '出生日期', value: '2000-01-01', type: 'text' },
        { id: 'f_1_4', title: '联系电话', value: '13800138000', type: 'text' },
        { id: 'f_1_5', title: '微信号', value: '13800138000', type: 'text' },
        { id: 'f_1_6', title: '电子邮箱', value: 'example@example.com', type: 'text' },
        { id: 'f_1_7', title: '国籍', value: '中国', type: 'text' },
        { id: 'f_1_8', title: '籍贯-省', value: 'XX省', type: 'text' },
        { id: 'f_1_9', title: '籍贯-市', value: 'XX市', type: 'text' },
        { id: 'f_1_10', title: '民族', value: '汉族', type: 'text' },
        { id: 'f_1_11', title: '政治面貌', value: '共青团员', type: 'text' },
        { id: 'f_1_12', title: '意向面试地点', value: '北京市', type: 'text' },
        { id: 'f_1_13', title: '求职方向', value: 'XX岗位', type: 'text' },
      ]
    },
    {
      id: 'cat_2',
      name: '教育经历',
      fields: [
        { id: 'f_2_1', title: '硕士-学校', value: 'XX大学', type: 'text' },
        { id: 'f_2_2', title: '硕士-学院', value: 'XX学院', type: 'text' },
        { id: 'f_2_3', title: '硕士-专业', value: 'XX专业', type: 'text' },
        { id: 'f_2_4', title: '硕士-学历', value: '硕士研究生', type: 'text' },
        { id: 'f_2_5', title: '硕士-成绩排名', value: '前20%', type: 'text' },
        { id: 'f_2_6', title: '硕士-开始时间', value: '2024-09', type: 'text' },
        { id: 'f_2_7', title: '硕士-毕业时间', value: '2027-06', type: 'text' },
        { id: 'f_2_8', title: '本科-学校', value: 'XX大学', type: 'text' },
        { id: 'f_2_9', title: '本科-学院', value: 'XX学院', type: 'text' },
        { id: 'f_2_10', title: '本科-专业', value: 'XX专业', type: 'text' },
        { id: 'f_2_11', title: '本科-学历', value: '大学本科', type: 'text' },
        { id: 'f_2_12', title: '本科-成绩排名', value: '前5%', type: 'text' },
        { id: 'f_2_13', title: '本科-开始时间', value: '2020-09', type: 'text' },
        { id: 'f_2_14', title: '本科-毕业时间', value: '2024-06', type: 'text' },
      ]
    },
    {
      id: 'cat_3',
      name: '实习经历',
      fields: [
        { id: 'f_3_1', title: '公司名称', value: 'XX公司', type: 'text' },
        { id: 'f_3_2', title: '开始时间', value: '2025-06', type: 'text' },
        { id: 'f_3_3', title: '结束时间', value: '2025-09', type: 'text' },
        { id: 'f_3_4', title: '任职部门', value: 'XX部门', type: 'text' },
        { id: 'f_3_5', title: '担任岗位', value: 'XX岗位', type: 'text' },
        { id: 'f_3_6', title: '工作职责', value: '', type: 'text' },
        { id: 'f_3_7', title: '工作描述', value: '', type: 'text' },
      ]
    },
    {
      id: 'cat_4',
      name: '工作经历',
      fields: [
        { id: 'f_4_1', title: '公司名称', value: 'XX公司', type: 'text' },
        { id: 'f_4_2', title: '开始时间', value: '2024-07', type: 'text' },
        { id: 'f_4_3', title: '结束时间', value: '至今', type: 'text' },
        { id: 'f_4_4', title: '任职部门', value: 'XX部门', type: 'text' },
        { id: 'f_4_5', title: '担任岗位', value: 'XX岗位', type: 'text' },
        { id: 'f_4_6', title: '工作职责', value: '', type: 'text' },
        { id: 'f_4_7', title: '工作描述', value: '', type: 'text' },
      ]
    },
    {
      id: 'cat_5',
      name: '项目经历',
      fields: [
        { id: 'f_5_1', title: '项目名称', value: 'XX项目', type: 'text' },
        { id: 'f_5_2', title: '开始时间', value: '2025-01', type: 'text' },
        { id: 'f_5_3', title: '结束时间', value: '至今', type: 'text' },
        { id: 'f_5_4', title: '项目角色', value: 'XX角色', type: 'text' },
        { id: 'f_5_5', title: '项目职责', value: '', type: 'text' },
        { id: 'f_5_6', title: '项目描述', value: '', type: 'text' },
      ]
    },
    {
      id: 'cat_6',
      name: '作品',
      fields: [
        { id: 'f_6_1', title: '作品链接', value: '', type: 'text' },
        { id: 'f_6_2', title: '作品描述', value: '', type: 'text' },
      ]
    },
    {
      id: 'cat_7',
      name: '自我评价',
      fields: [
        { id: 'f_7_1', title: '个人评价', value: '', type: 'text' },
        { id: 'f_7_2', title: '工具/技能', value: '', type: 'text' },
        { id: 'f_7_3', title: '荣誉奖项', value: '', type: 'text' },
        { id: 'f_7_4', title: '爱好', value: '', type: 'text' },
      ]
    }
  ],
  settings: {
    collapsed: false,
    panelPosition: { right: 20, top: 80 },
    panelSize: { width: 340, height: null }
  }
};

const TEXT_INPUT_TYPES = new Set([
  '',
  'text',
  'search',
  'url',
  'tel',
  'email',
  'password',
  'number',
  'date',
  'month',
  'week',
  'time',
  'datetime-local'
]);
const FIELD_WARNING_LIMIT = 500;
const FIELD_WARNING_TEXT = '为保障HR阅读，建议字数<500。';

function cloneDefaultData() {
  return JSON.parse(JSON.stringify(DEFAULT_DATA));
}

function normalizeAppData(data) {
  const normalized = data && typeof data === 'object' ? data : {};
  const defaultData = cloneDefaultData();
  const settings = normalized.settings && typeof normalized.settings === 'object'
    ? normalized.settings
    : {};

  return {
    ...defaultData,
    ...normalized,
    categories: Array.isArray(normalized.categories) ? normalized.categories : defaultData.categories,
    settings: {
      ...defaultData.settings,
      ...settings,
      panelPosition: {
        ...defaultData.settings.panelPosition,
        ...(settings.panelPosition || {})
      },
      panelSize: {
        ...defaultData.settings.panelSize,
        ...(settings.panelSize || {})
      }
    }
  };
}

function focusPageElement(el) {
  if (!el || !document.contains(el) || isPanelElement(el) || !isEditableElement(el)) return;
  lastFocusedElement = el;
  lastPastedElement = el;
  setTimeout(() => {
    if (document.contains(el)) {
      el.focus({ preventScroll: true });
    }
  }, 0);
}

// ============ 初始化 ============
// 页面加载后立即准备，监听来自 popup 的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'toggle') {
    togglePanel();
    sendResponse({ visible: panelVisible });
    return true;
  }
  if (message.action === 'show') {
    showPanel();
    sendResponse({ visible: true });
    return true;
  }
  if (message.action === 'hide') {
    hidePanel();
    sendResponse({ visible: false });
    return true;
  }
  if (message.action === 'getStatus') {
    sendResponse({ visible: panelVisible, injected: panelInjected });
    return true;
  }
});

// 页面加载时加载数据并准备面板
(async () => {
  await loadData();
  injectPanel();
})();

// ============ 监听输入框聚焦事件 ============
document.addEventListener('focusin', (e) => {
  const el = e.target;
  if (isEditableElement(el) && !isPanelElement(el)) {
    lastFocusedElement = el;
  }
}, true);

document.addEventListener('click', (e) => {
  const el = e.target;
  if (isEditableElement(el) && !isPanelElement(el)) {
    lastFocusedElement = el;
  }
}, true);

/** 判断是否为可编辑元素 */
function isEditableElement(el) {
  if (!el || !el.tagName) return false;
  const tag = el.tagName.toLowerCase();
  if (tag === 'input') {
    const type = (el.getAttribute('type') || 'text').toLowerCase();
    return TEXT_INPUT_TYPES.has(type) && !el.disabled && !el.readOnly;
  }
  if (tag === 'textarea') return !el.disabled && !el.readOnly;
  if (el.isContentEditable) return true;
  return false;
}

/** 判断是否为面板内部元素（避免把面板内的输入框记录为粘贴目标） */
function isPanelElement(el) {
  return el && el.closest && el.closest('#resume-assistant-panel');
}

// ============ 数据加载/保存 ============
function loadData() {
  return new Promise((resolve) => {
    chrome.storage.local.get('resumeAssistantData', (result) => {
      if (result.resumeAssistantData) {
        appData = normalizeAppData(result.resumeAssistantData);
      } else {
        appData = cloneDefaultData();
        saveData();
      }
      resolve();
    });
  });
}

function saveData() {
  _selfSaveTime = Date.now();
  chrome.storage.local.set({ resumeAssistantData: appData });
}

let saveTimer = null;
function debounceSave() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => saveData(), 300);
}

// 监听外部数据变更（如 options 页面修改）
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local' && changes.resumeAssistantData) {
    if (Date.now() - _selfSaveTime < 1000) return;
    const newData = changes.resumeAssistantData.newValue;
    if (newData) {
      appData = normalizeAppData(newData);
      if (panelInjected) {
        renderCategoryTabs();
        renderFields();
      }
    }
  }
});

// ============ 注入浮动面板 ============
function injectPanel() {
  if (panelInjected) return;
  
  // 创建面板容器
  panelEl = document.createElement('div');
  panelEl.id = 'resume-assistant-panel';
  panelEl.innerHTML = buildPanelHTML();
  document.body.appendChild(panelEl);
  
  panelInjected = true;
  
  // 恢复位置
  restorePanelPosition();
  
  // 绑定面板内部事件
  bindPanelEvents();
  
  // 渲染内容
  renderCategoryTabs();
  renderFields();
  
  // 默认隐藏（等用户通过 popup 打开）
  panelEl.style.display = 'none';
  panelVisible = false;
  
  console.log('[简历快投助手] 浮动面板已注入 ✓');
}

/** 构建面板 HTML 结构 */
function buildPanelHTML() {
  const logoUrl = chrome.runtime.getURL('icons/logo-48.png');
  return `
    <!-- 拖动标题栏 -->
    <div class="ra-panel-header" id="ra-drag-handle">
      <div class="ra-header-left">
        <span class="ra-grip-icon">⠿</span>
        <img class="ra-logo" src="${logoUrl}" alt="">
        <span class="ra-title">简历快投助手</span>
      </div>
      <div class="ra-header-right">
        <button class="ra-btn ra-btn-close" id="ra-btn-close" title="关闭面板">✕</button>
      </div>
    </div>
    
    <!-- 展开视图 -->
    <div class="ra-expanded-view" id="ra-expanded-view">
      <!-- 使用提示 -->
      <div class="ra-tip-bar"><kbd>Tab</kbd><span>输入下个字段</span></div>
      
      <!-- 分类标签栏 -->
      <div class="ra-category-tabs" id="ra-category-tabs">
        <div class="ra-tabs-scroll" id="ra-tabs-scroll">
          <!-- 动态生成 -->
        </div>
      </div>
      
      <!-- 字段列表 -->
      <div class="ra-fields-container" id="ra-fields-container">
        <!-- 动态生成 -->
      </div>
      
      <!-- 底部栏 -->
      <div class="ra-footer">
        <span class="ra-field-count" id="ra-field-count"></span>
        <button class="ra-btn ra-btn-settings" id="ra-btn-open-settings" title="打开设置">⚙ 管理</button>
      </div>
    </div>
    
    <!-- 拉伸把手（底部） -->
    <div class="ra-resize-handle" id="ra-resize-handle"></div>
  `;
}

// ============ 面板显隐控制 ============
function togglePanel() {
  if (panelVisible) {
    hidePanel();
  } else {
    showPanel();
  }
}

function showPanel() {
  if (!panelInjected) {
    injectPanel();
  }
  panelEl.style.display = '';
  panelVisible = true;
}

function hidePanel() {
  if (panelEl) {
    panelEl.style.display = 'none';
  }
  panelVisible = false;
}

// ============ 渲染：分类标签 ============
function renderCategoryTabs() {
  const tabsContainer = document.getElementById('ra-tabs-scroll');
  if (!tabsContainer) return;
  tabsContainer.innerHTML = '';

  if (appData.categories.length === 0) {
    tabsContainer.innerHTML = '<div class="ra-empty-tab">暂无分类，请前往设置添加</div>';
    return;
  }

  appData.categories.forEach((cat) => {
    const tab = document.createElement('div');
    tab.className = 'ra-tab-item';
    tab.textContent = cat.name;
    tab.dataset.catId = cat.id;

    if (cat.id === currentCategoryId || (!currentCategoryId && cat.id === appData.categories[0].id)) {
      tab.classList.add('active');
      currentCategoryId = cat.id;
    }

    tab.addEventListener('click', () => {
      currentCategoryId = cat.id;
      tabsContainer.querySelectorAll('.ra-tab-item').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      centerCategoryTab(tab, tabsContainer);
      renderFields();
    });

    tabsContainer.appendChild(tab);
  });
}

function centerCategoryTab(tab, container) {
  const tabs = Array.from(container.querySelectorAll('.ra-tab-item'));
  const index = tabs.indexOf(tab);
  if (index <= 0 || index === tabs.length - 1) return;

  const targetLeft = tab.offsetLeft - (container.clientWidth - tab.offsetWidth) / 2;
  container.scrollTo({
    left: Math.max(0, targetLeft),
    behavior: 'smooth'
  });
}

// ============ 渲染：字段列表 ============
function renderFields() {
  const container = document.getElementById('ra-fields-container');
  if (!container) return;
  container.innerHTML = '';

  const category = appData.categories.find(c => c.id === currentCategoryId);
  if (!category || category.fields.length === 0) {
    container.innerHTML = `
      <div class="ra-empty-state">
        <div>暂无字段，请先到设置页添加</div>
      </div>`;
    return;
  }

  category.fields.forEach((field) => {
    const card = document.createElement('div');
    card.className = 'ra-field-card';
    card.dataset.fieldId = field.id;

    // 标题行
    const titleRow = document.createElement('div');
    titleRow.className = 'ra-field-title';

    const titleText = document.createElement('span');
    titleText.className = 'ra-field-title-text';
    titleText.textContent = field.title;
    titleText.title = field.title;

    const pasteBtn = document.createElement('button');
    pasteBtn.className = 'ra-btn-paste';
    pasteBtn.textContent = '粘贴';
    pasteBtn.title = '将内容粘贴到页面中上次聚焦的输入框';
    pasteBtn.addEventListener('click', () => handlePaste(field, pasteBtn));

    titleRow.appendChild(titleText);
    titleRow.appendChild(pasteBtn);

    // 文本输入框
    const input = document.createElement('textarea');
    input.className = 'ra-field-input';
    input.placeholder = `输入${field.title}...`;
    input.value = field.value || '';
    input.rows = 2;

    const metaRow = document.createElement('div');
    metaRow.className = 'ra-field-meta';

    const warningText = document.createElement('span');
    warningText.className = 'ra-field-warning';

    const syncFieldMeta = () => {
      const length = input.value.length;
      warningText.textContent = length > FIELD_WARNING_LIMIT ? FIELD_WARNING_TEXT : '';
      card.classList.toggle('over-limit', length > FIELD_WARNING_LIMIT);
      metaRow.classList.toggle('hidden', length <= FIELD_WARNING_LIMIT);
    };

    input.addEventListener('input', () => {
      field.value = input.value;
      syncFieldMeta();
      debounceSave();
    });

    // Tab 键跳到下一个字段
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Tab' && !e.shiftKey) {
        e.preventDefault();
        // 找到当前字段的下一个输入框
        const allInputs = container.querySelectorAll('.ra-field-input');
        const inputArray = Array.from(allInputs);
        const currentIndex = inputArray.indexOf(input);
        if (currentIndex < inputArray.length - 1) {
          inputArray[currentIndex + 1].focus();
        }
      }
    });

    card.appendChild(titleRow);
    card.appendChild(input);
    metaRow.appendChild(warningText);
    card.appendChild(metaRow);
    container.appendChild(card);
    syncFieldMeta();
  });

  updateFooter();
}

// ============ 一键粘贴 ============
function handlePaste(field, btn) {
  if (!field.value || field.value.trim() === '') {
    btn.textContent = '空!';
    setTimeout(() => { btn.textContent = '粘贴'; }, 1000);
    return;
  }

  const result = performPaste(field.value, field.title);
  if (result && result.success && result.target) {
    focusPageElement(result.target);
  } else if (lastPastedElement) {
    focusPageElement(lastPastedElement);
  }
  handlePasteResponse(result, btn);
}

function handlePasteResponse(result, btn) {
  if (result && result.success) {
    btn.textContent = '✓';
    btn.classList.add('success');
    setTimeout(() => {
      btn.textContent = '粘贴';
      btn.classList.remove('success');
    }, 1200);
  } else {
    btn.textContent = '失败';
    setTimeout(() => { btn.textContent = '粘贴'; }, 1500);
  }
}

// ============ 执行粘贴操作 ============
function performPaste(value, title) {
  let target = lastFocusedElement || document.activeElement;

  if (target && !document.contains(target)) {
    target = document.activeElement;
  }

  if (!target || target === document.body || target === document.documentElement || isPanelElement(target) || !isEditableElement(target)) {
    return { success: false, message: '未找到目标输入框，请先点击页面上的输入框' };
  }

  const tag = target.tagName.toLowerCase();

  try {
    if (tag === 'input' || tag === 'textarea') {
      return { ...pasteToInput(target, value), target };
    } else if (target.isContentEditable) {
      return { ...pasteToContentEditable(target, value), target };
    } else {
      return { success: false, message: `不支持的元素类型: ${tag}` };
    }
  } catch (err) {
    return { success: false, message: `粘贴失败: ${err.message}` };
  }
}

/** 粘贴到 input/textarea */
function pasteToInput(el, value) {
  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype, 'value'
  ).set;
  const nativeTextareaValueSetter = Object.getOwnPropertyDescriptor(
    window.HTMLTextAreaElement.prototype, 'value'
  ).set;

  const setter = el.tagName.toLowerCase() === 'textarea'
    ? nativeTextareaValueSetter
    : nativeInputValueSetter;

  setter.call(el, value);

  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
  el.dispatchEvent(new Event('blur', { bubbles: true }));
  el.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true }));
  el.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));

  return { success: true };
}

/** 粘贴到 contenteditable */
function pasteToContentEditable(el, value) {
  el.textContent = value;
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
  return { success: true };
}

// ============ 底部栏 ============
function updateFooter() {
  const el = document.getElementById('ra-field-count');
  if (!el) return;
  const category = appData.categories.find(c => c.id === currentCategoryId);
  const count = category ? category.fields.length : 0;
  el.textContent = `${count} 个字段`;
}

// ============ 面板事件绑定 ============
function bindPanelEvents() {
  // 关闭按钮
  const closeBtn = document.getElementById('ra-btn-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => hidePanel());
  }

  // 打开设置
  const settingsBtn = document.getElementById('ra-btn-open-settings');
  if (settingsBtn) {
    settingsBtn.addEventListener('click', () => {
      chrome.runtime.sendMessage({ action: 'openOptions' });
    });
  }

  // ============ 拖动功能 ============
  initDrag();
  
  // ============ 拉伸功能 ============
  initResize();
}

// ============ 拖动实现 ============
function initDrag() {
  const handle = document.getElementById('ra-drag-handle');
  if (!handle || !panelEl) return;

  let isDragging = false;
  let startX, startY;
  let initialRight, initialTop;

  handle.addEventListener('mousedown', (e) => {
    // 排除按钮点击
    if (e.target.closest('.ra-btn')) return;
    
    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;
    
    const rect = panelEl.getBoundingClientRect();
    initialRight = window.innerWidth - rect.right;
    initialTop = rect.top;
    
    panelEl.style.transition = 'none';
    handle.style.cursor = 'grabbing';
    e.preventDefault();
  });

  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    
    let newRight = initialRight - dx;
    let newTop = initialTop + dy;
    
    // 边界限制
    const panelRect = panelEl.getBoundingClientRect();
    const maxRight = window.innerWidth - 100;
    const maxTop = window.innerHeight - 100;
    
    newRight = Math.max(-maxRight, Math.min(maxRight, newRight));
    newTop = Math.max(10, Math.min(maxTop, newTop));
    
    panelEl.style.right = newRight + 'px';
    panelEl.style.top = newTop + 'px';
    panelEl.style.left = 'auto';
  });

  document.addEventListener('mouseup', () => {
    if (!isDragging) return;
    isDragging = false;
    handle.style.cursor = 'grab';
    panelEl.style.transition = '';
    
    // 保存位置
    const rect = panelEl.getBoundingClientRect();
    appData.settings.panelPosition = {
      right: parseInt(panelEl.style.right) || (window.innerWidth - rect.right),
      top: parseInt(panelEl.style.top) || rect.top
    };
    saveData();
  });
}

// ============ 拉伸实现 ============
function initResize() {
  const handle = document.getElementById('ra-resize-handle');
  if (!handle || !panelEl) return;

  let isResizing = false;
  let startY, startHeight;

  handle.addEventListener('mousedown', (e) => {
    isResizing = true;
    startY = e.clientY;
    startHeight = panelEl.getBoundingClientRect().height;
    panelEl.style.transition = 'none';
    e.preventDefault();
  });

  document.addEventListener('mousemove', (e) => {
    if (!isResizing) return;
    
    const dy = e.clientY - startY;
    let newHeight = startHeight + dy;
    
    // 最小高度 200px，最大不超过视口高度 - 40px
    const minHeight = 200;
    const maxHeight = window.innerHeight - 40;
    newHeight = Math.max(minHeight, Math.min(maxHeight, newHeight));
    
    panelEl.style.height = newHeight + 'px';
  });

  document.addEventListener('mouseup', () => {
    if (!isResizing) return;
    isResizing = false;
    panelEl.style.transition = '';
    
    // 保存高度
    appData.settings.panelSize.height = panelEl.getBoundingClientRect().height;
    saveData();
  });
}

// ============ 恢复面板位置 ============
function restorePanelPosition() {
  if (!panelEl) return;
  
  const pos = appData.settings.panelPosition;
  if (pos) {
    panelEl.style.right = (pos.right || 20) + 'px';
    panelEl.style.top = (pos.top || 80) + 'px';
    panelEl.style.left = 'auto';
  }
  
  const size = appData.settings.panelSize;
  if (size && size.width) {
    panelEl.style.width = size.width + 'px';
  }
  if (size && size.height) {
    panelEl.style.height = size.height + 'px';
  }
}

// ============ Toast 提示（保留兼容） ============
let toastTimer = null;
function showToast(message, duration = 2000) {
  const existing = document.getElementById('resume-assistant-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'resume-assistant-toast';
  toast.textContent = message;
  document.body.appendChild(toast);

  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.add('fade-out');
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

console.log('[简历快投助手] Content script 已加载，准备就绪 ✓');
