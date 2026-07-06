/**
 * 简历快投助手 - 设置页面逻辑
 * 负责：分类管理（增删改排序）、字段管理（增删改排序）
 */

// ============ 全局状态 ============
let appData = null;
let selectedCategoryId = null;
let saveTimer = null;
const FIELD_WARNING_LIMIT = 500;
const FIELD_WARNING_TEXT = '为保障HR阅读，建议字数<500。';

// ============ 初始化 ============
document.addEventListener('DOMContentLoaded', async () => {
  await loadData();
  renderCategoriesList();
  // 默认选中第一个分类
  if (appData.categories.length > 0) {
    selectCategory(appData.categories[0].id);
  }
  bindEvents();
});

// ============ 数据加载/保存 ============
function loadData() {
  return new Promise((resolve) => {
    chrome.storage.local.get('resumeAssistantData', (result) => {
      if (result.resumeAssistantData) {
        appData = result.resumeAssistantData;
      } else {
        appData = {
          categories: [],
          settings: { collapsed: false, position: { x: 100, y: 100 } }
        };
      }
      resolve();
    });
  });
}

/** 防抖保存 */
function saveData() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    chrome.storage.local.set({ resumeAssistantData: appData }, () => {
      showSaveStatus();
    });
  }, 200);
}

/** 显示保存成功提示 */
function showSaveStatus() {
  const el = document.getElementById('save-status');
  el.textContent = '✓ 已保存';
  el.classList.add('flash');
  setTimeout(() => el.classList.remove('flash'), 800);
}

// ============ 渲染分类列表 ============
function renderCategoriesList() {
  const list = document.getElementById('categories-list');
  list.innerHTML = '';

  if (appData.categories.length === 0) {
    list.innerHTML = '<div class="empty-hint">暂无分类，点击上方按钮新增</div>';
    return;
  }

  appData.categories.forEach((cat, index) => {
    const item = document.createElement('div');
    item.className = 'category-item' + (cat.id === selectedCategoryId ? ' active' : '');
    item.dataset.catId = cat.id;

    const safeName = escapeHtml(cat.name);
    item.innerHTML = `
      <span class="category-name" title="${safeName}">${safeName}</span>
      <span class="category-count">${cat.fields.length}个字段</span>
      <div class="category-actions">
        <button class="btn-icon btn-move-up" title="上移" ${index === 0 ? 'disabled' : ''}>↑</button>
        <button class="btn-icon btn-move-down" title="下移" ${index === appData.categories.length - 1 ? 'disabled' : ''}>↓</button>
        <button class="btn-icon btn-rename" title="重命名">✏</button>
        <button class="btn-icon btn-delete" title="删除">🗑</button>
      </div>
    `;

    // 点击选中分类
    item.addEventListener('click', (e) => {
      // 如果点击的是按钮，不触发选中
      if (e.target.closest('.category-actions')) return;
      selectCategory(cat.id);
    });

    // 绑定按钮事件
    item.querySelector('.btn-move-up').addEventListener('click', () => moveCategory(cat.id, -1));
    item.querySelector('.btn-move-down').addEventListener('click', () => moveCategory(cat.id, 1));
    item.querySelector('.btn-rename').addEventListener('click', () => renameCategory(cat.id));
    item.querySelector('.btn-delete').addEventListener('click', () => deleteCategory(cat.id));

    list.appendChild(item);
  });
}

// ============ 渲染字段列表 ============
function renderFieldsList() {
  const list = document.getElementById('fields-list');
  const titleEl = document.getElementById('current-category-title');
  const addBtn = document.getElementById('btn-add-field');

  const category = appData.categories.find(c => c.id === selectedCategoryId);

  if (!category) {
    titleEl.textContent = '请选择一个分类';
    list.innerHTML = '<div class="empty-hint">← 请先选择或创建一个分类</div>';
    addBtn.disabled = true;
    return;
  }

  titleEl.textContent = `「${category.name}」的字段`;
  addBtn.disabled = false;
  list.innerHTML = '';

  if (category.fields.length === 0) {
    list.innerHTML = '<div class="empty-hint">暂无字段，点击上方按钮新增</div>';
    return;
  }

  category.fields.forEach((field, index) => {
    const item = document.createElement('div');
    item.className = 'field-item';
    item.dataset.fieldId = field.id;

    item.innerHTML = `
      <div class="field-row">
        <input type="text" class="field-title-input" value="${escapeHtml(field.title)}" 
               placeholder="字段名称" title="字段名称">
        <div class="field-actions">
          <button class="btn-icon btn-move-up" title="上移" ${index === 0 ? 'disabled' : ''}>↑</button>
          <button class="btn-icon btn-move-down" title="下移" ${index === category.fields.length - 1 ? 'disabled' : ''}>↓</button>
          <button class="btn-icon btn-delete" title="删除">🗑</button>
        </div>
      </div>
      <textarea class="field-value-input" placeholder="输入${escapeHtml(field.title)}的内容..."
                rows="2">${escapeHtml(field.value || '')}</textarea>
      <div class="field-meta">
        <span class="field-warning"></span>
        <span class="field-counter"></span>
      </div>
    `;

    // 标题修改
    const titleInput = item.querySelector('.field-title-input');
    titleInput.addEventListener('input', () => {
      field.title = titleInput.value;
      saveData();
      renderCategoriesList(); // 更新分类显示（字段数）
    });

    // 内容修改
    const valueInput = item.querySelector('.field-value-input');
    const warningText = item.querySelector('.field-warning');
    const countText = item.querySelector('.field-counter');
    const syncFieldMeta = () => {
      const length = valueInput.value.length;
      countText.textContent = `${length}`;
      warningText.textContent = length > FIELD_WARNING_LIMIT ? FIELD_WARNING_TEXT : '';
      item.classList.toggle('over-limit', length > FIELD_WARNING_LIMIT);
    };

    valueInput.addEventListener('input', () => {
      field.value = valueInput.value;
      syncFieldMeta();
      saveData();
    });

    // 按钮事件
    item.querySelector('.btn-move-up').addEventListener('click', () => moveField(field.id, -1));
    item.querySelector('.btn-move-down').addEventListener('click', () => moveField(field.id, 1));
    item.querySelector('.btn-delete').addEventListener('click', () => deleteField(field.id));

    list.appendChild(item);
    syncFieldMeta();
  });
}

// ============ 选中分类 ============
function selectCategory(catId) {
  selectedCategoryId = catId;
  // 更新列表样式
  document.querySelectorAll('.category-item').forEach(el => {
    el.classList.toggle('active', el.dataset.catId === catId);
  });
  renderFieldsList();
}

// ============ 分类操作 ============
function addCategory() {
  const name = prompt('请输入新分类名称：');
  if (!name || !name.trim()) return;

  const newCat = {
    id: 'cat_' + Date.now(),
    name: name.trim(),
    fields: []
  };
  appData.categories.push(newCat);
  saveData();
  renderCategoriesList();
  selectCategory(newCat.id);
}

function renameCategory(catId) {
  const cat = appData.categories.find(c => c.id === catId);
  if (!cat) return;

  const newName = prompt('重命名分类：', cat.name);
  if (!newName || !newName.trim() || newName.trim() === cat.name) return;

  cat.name = newName.trim();
  saveData();
  renderCategoriesList();
  renderFieldsList();
}

function deleteCategory(catId) {
  const cat = appData.categories.find(c => c.id === catId);
  if (!cat) return;

  if (!confirm(`确定删除分类「${cat.name}」及其所有字段吗？`)) return;

  appData.categories = appData.categories.filter(c => c.id !== catId);
  if (selectedCategoryId === catId) {
    selectedCategoryId = appData.categories.length > 0 ? appData.categories[0].id : null;
  }
  saveData();
  renderCategoriesList();
  renderFieldsList();
}

function moveCategory(catId, direction) {
  const index = appData.categories.findIndex(c => c.id === catId);
  const newIndex = index + direction;
  if (newIndex < 0 || newIndex >= appData.categories.length) return;

  // 交换位置
  [appData.categories[index], appData.categories[newIndex]] =
    [appData.categories[newIndex], appData.categories[index]];

  saveData();
  renderCategoriesList();
}

// ============ 字段操作 ============
function addField() {
  const category = appData.categories.find(c => c.id === selectedCategoryId);
  if (!category) return;

  const newField = {
    id: 'f_' + Date.now(),
    title: '新字段',
    value: '',
    type: 'text'
  };
  category.fields.push(newField);
  saveData();
  renderFieldsList();
  renderCategoriesList();
}

function deleteField(fieldId) {
  const category = appData.categories.find(c => c.id === selectedCategoryId);
  if (!category) return;

  const field = category.fields.find(f => f.id === fieldId);
  if (!field) return;

  if (!confirm(`确定删除字段「${field.title}」吗？`)) return;

  category.fields = category.fields.filter(f => f.id !== fieldId);
  saveData();
  renderFieldsList();
  renderCategoriesList();
}

function moveField(fieldId, direction) {
  const category = appData.categories.find(c => c.id === selectedCategoryId);
  if (!category) return;

  const index = category.fields.findIndex(f => f.id === fieldId);
  const newIndex = index + direction;
  if (newIndex < 0 || newIndex >= category.fields.length) return;

  [category.fields[index], category.fields[newIndex]] =
    [category.fields[newIndex], category.fields[index]];

  saveData();
  renderFieldsList();
}

// ============ 事件绑定 ============
function bindEvents() {
  document.getElementById('btn-back').addEventListener('click', goBack);
  document.getElementById('btn-add-category').addEventListener('click', addCategory);
  document.getElementById('btn-add-field').addEventListener('click', addField);
}

function goBack() {
  if (window.history.length > 1) {
    window.history.back();
    return;
  }
  window.close();
}

// ============ 工具函数 ============
/** HTML 转义 */
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
