/**
 * Settings page — провайдеры AI, профиль пользователя, история.
 */

document.addEventListener('DOMContentLoaded', init);

const PROVIDER_IDS = ['gemini', 'openai', 'deepseek'];

const ui = {};
let activeProvider = 'gemini';

function init() {
  cacheElements();
  bindEvents();
  loadData();
}

function cacheElements() {
  const ids = [
    'saveProvider', 'testProvider',
    'apiKey_gemini', 'apiKey_openai', 'apiKey_deepseek',
    'model_gemini', 'model_openai', 'model_deepseek',
    'profileName', 'profileSkills', 'profileExperience',
    'profileEducation', 'profileTone',
    'saveProfile', 'resetProfile',
    'historyList', 'clearHistory',
    'toast', 'toastText'
  ];
  for (const id of ids) {
    ui[id] = document.getElementById(id);
  }
}

function bindEvents() {
  // Provider tabs
  document.querySelectorAll('.provider-tab').forEach(tab => {
    tab.addEventListener('click', () => switchProvider(tab.dataset.provider));
  });

  // Toggle visibility buttons
  document.querySelectorAll('.toggle-visibility').forEach(btn => {
    btn.addEventListener('click', () => {
      const input = document.getElementById(btn.dataset.target);
      input.type = input.type === 'password' ? 'text' : 'password';
    });
  });

  ui.saveProvider.addEventListener('click', saveProviderSettings);
  ui.testProvider.addEventListener('click', testProviderKey);
  ui.saveProfile.addEventListener('click', saveProfile);
  ui.resetProfile.addEventListener('click', resetProfile);
  ui.clearHistory.addEventListener('click', clearHistory);
}

// --- Provider tabs ---

function switchProvider(provider) {
  activeProvider = provider;

  document.querySelectorAll('.provider-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.provider === provider);
  });
  document.querySelectorAll('.provider-panel').forEach(panel => {
    panel.classList.toggle('active', panel.dataset.panel === provider);
  });
}

// --- Load/Save ---

async function loadData() {
  const keys = [
    'aiProvider', 'aiModel',
    'apiKey_gemini', 'apiKey_openai', 'apiKey_deepseek',
    'geminiApiKey', 'geminiModel',
    'userProfile', 'coverLetterHistory'
  ];
  const data = await chrome.storage.local.get(keys);

  // Миграция со старого формата
  if (data.geminiApiKey && !data.apiKey_gemini) {
    data.apiKey_gemini = data.geminiApiKey;
    await chrome.storage.local.set({ apiKey_gemini: data.geminiApiKey });
  }

  // Провайдер
  const provider = data.aiProvider || 'gemini';
  switchProvider(provider);

  // API ключи
  if (data.apiKey_gemini) ui.apiKey_gemini.value = data.apiKey_gemini;
  if (data.apiKey_openai) ui.apiKey_openai.value = data.apiKey_openai;
  if (data.apiKey_deepseek) ui.apiKey_deepseek.value = data.apiKey_deepseek;

  // Модель
  const model = data.aiModel || data.geminiModel;
  if (model) {
    const modelSelect = ui[`model_${provider}`];
    if (modelSelect) {
      const option = modelSelect.querySelector(`option[value="${model}"]`);
      if (option) modelSelect.value = model;
    }
  }

  // Профиль
  if (data.userProfile) {
    const p = data.userProfile;
    ui.profileName.value = p.name || '';
    ui.profileSkills.value = p.skills || '';
    ui.profileExperience.value = p.experience || '';
    ui.profileEducation.value = p.education || '';
    ui.profileTone.value = p.tone || 'professional';
  }

  renderHistory(data.coverLetterHistory || []);
}

async function saveProviderSettings() {
  const apiKey = ui[`apiKey_${activeProvider}`]?.value.trim();
  const model = ui[`model_${activeProvider}`]?.value;

  if (!apiKey) {
    showToast('Введите API-ключ', 'error');
    return;
  }

  await chrome.storage.local.set({
    aiProvider: activeProvider,
    aiModel: model,
    [`apiKey_${activeProvider}`]: apiKey
  });

  showToast(`${getProviderName(activeProvider)} сохранён`, 'success');
}

// --- Test (прямые вызовы API, без background worker) ---

const API_CONFIGS = {
  gemini: {
    buildUrl: (model) => `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    buildRequest: (apiKey, model) => ({
      url: `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      options: {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'Respond with OK' }] }],
          generationConfig: { maxOutputTokens: 10 }
        })
      }
    })
  },
  openai: {
    buildRequest: (apiKey, model) => ({
      url: 'https://api.openai.com/v1/chat/completions',
      options: {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: 'Respond with OK' }],
          max_tokens: 10
        })
      }
    })
  },
  deepseek: {
    buildRequest: (apiKey, model) => ({
      url: 'https://api.deepseek.com/v1/chat/completions',
      options: {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: 'Respond with OK' }],
          max_tokens: 10
        })
      }
    })
  }
};

/**
 * Переводит серверные ошибки API в понятные русскоязычные сообщения.
 */
function humanizeError(status, message, provider) {
  const lower = (message || '').toLowerCase();

  if (status === 401 || lower.includes('unauthorized') || lower.includes('invalid api key') || lower.includes('invalid_api_key'))
    return 'Неверный API-ключ. Проверьте, что ключ скопирован правильно.';

  if (status === 403 || lower.includes('permission') || lower.includes('forbidden'))
    return 'Доступ запрещён. Проверьте права API-ключа.';

  if (lower.includes('insufficient') || lower.includes('balance'))
    return 'Недостаточно средств на балансе. Пополните баланс в личном кабинете.';

  if (lower.includes('quota') || lower.includes('exceeded')) {
    if (provider === 'gemini')
      return 'Бесплатный лимит Gemini исчерпан. Подождите или попробуйте другую модель.';
    return 'Лимит запросов исчерпан. Пополните баланс или подождите.';
  }

  if (lower.includes('billing') || lower.includes('deactivated'))
    return 'Аккаунт деактивирован или проблема с оплатой. Проверьте настройки биллинга.';

  if (status === 404 || lower.includes('not found') || lower.includes('not supported'))
    return `Модель не найдена. Попробуйте другую.`;

  if (status === 429)
    return 'Слишком много запросов. Подождите немного и попробуйте снова.';

  if (status === 503 || lower.includes('unavailable') || lower.includes('high demand'))
    return 'Сервер перегружен. Попробуйте позже.';

  if (status === 529 || lower.includes('overloaded'))
    return 'Сервер перегружен. Попробуйте позже.';

  return message || `Неизвестная ошибка (HTTP ${status})`;
}

/**
 * Ошибки, при которых бессмысленно пробовать другую модель —
 * проблема в ключе/аккаунте, а не в конкретной модели.
 */
function isAccountError(status, message) {
  const lower = (message || '').toLowerCase();
  return status === 401 || status === 403 ||
    lower.includes('insufficient') || lower.includes('balance') ||
    lower.includes('invalid') || lower.includes('unauthorized') ||
    lower.includes('authentication') || lower.includes('permission') ||
    lower.includes('billing') || lower.includes('deactivated') ||
    lower.includes('quota') || lower.includes('exceeded');
}

/**
 * Ошибки, при которых имеет смысл попробовать другую модель —
 * конкретная модель недоступна, но другие могут работать.
 */
function isModelRetryable(status, message) {
  if (isAccountError(status, message)) return false;
  const lower = (message || '').toLowerCase();
  return status === 404 || status === 503 || status === 529 ||
    lower.includes('not found') || lower.includes('not supported') ||
    lower.includes('unavailable') || lower.includes('high demand') ||
    lower.includes('overloaded');
}

async function testProviderKey() {
  const apiKey = ui[`apiKey_${activeProvider}`]?.value.trim();
  if (!apiKey) {
    showToast('Сначала введите API-ключ', 'error');
    return;
  }

  const config = API_CONFIGS[activeProvider];
  if (!config) {
    showToast('Неизвестный провайдер', 'error');
    return;
  }

  const modelSelect = ui[`model_${activeProvider}`];
  const models = Array.from(modelSelect.options).map(o => o.value);
  const preferred = modelSelect.value;
  const modelsToTry = [preferred, ...models.filter(m => m !== preferred)];

  ui.testProvider.disabled = true;

  for (const model of modelsToTry) {
    ui.testProvider.textContent = `${model}...`;

    try {
      const { url, options } = config.buildRequest(apiKey, model);
      const response = await fetch(url, options);

      if (response.ok) {
        if (model !== preferred) modelSelect.value = model;
        showToast(`Ключ работает! Модель: ${model}`, 'success');
        resetTestBtn();
        return;
      }

      const err = await response.json().catch(() => ({}));
      const errMsg = err?.error?.message || `HTTP ${response.status}`;

      // Ошибка аккаунта — показываем сразу, не пробуем другие модели
      if (isAccountError(response.status, errMsg)) {
        showToast(humanizeError(response.status, errMsg, activeProvider), 'error');
        resetTestBtn();
        return;
      }

      // Ошибка модели — пробуем следующую
      if (isModelRetryable(response.status, errMsg)) continue;

      // Неизвестная ошибка — показываем
      showToast(humanizeError(response.status, errMsg, activeProvider), 'error');
      resetTestBtn();
      return;

    } catch (err) {
      showToast('Нет подключения к серверу. Проверьте интернет.', 'error');
      resetTestBtn();
      return;
    }
  }

  showToast('Все модели временно недоступны. Попробуйте позже.', 'error');
  resetTestBtn();
}

function resetTestBtn() {
  ui.testProvider.disabled = false;
  ui.testProvider.textContent = 'Проверить ключ';
}

// --- Profile ---

async function saveProfile() {
  const profile = {
    name: ui.profileName.value.trim(),
    skills: ui.profileSkills.value.trim(),
    experience: ui.profileExperience.value.trim(),
    education: ui.profileEducation.value.trim(),
    tone: ui.profileTone.value
  };

  await chrome.storage.local.set({ userProfile: profile });
  showToast('Профиль сохранён', 'success');
}

async function resetProfile() {
  if (!confirm('Сбросить все данные профиля?')) return;

  ui.profileName.value = '';
  ui.profileSkills.value = '';
  ui.profileExperience.value = '';
  ui.profileEducation.value = '';
  ui.profileTone.value = 'professional';

  await chrome.storage.local.remove('userProfile');
  showToast('Профиль сброшен', 'success');
}

// --- History ---

function renderHistory(history) {
  if (!history.length) {
    ui.historyList.innerHTML = '<p class="text-muted">История пуста</p>';
    return;
  }

  ui.historyList.innerHTML = history.map((item, i) => {
    const providerBadge = item.provider ? `<span class="history-badge">${item.provider}</span>` : '';
    return `
    <div class="history-item">
      <div class="history-item__info">
        <div class="history-item__title">${escapeHtml(item.jobTitle || 'Без названия')} — ${escapeHtml(item.company || '?')}</div>
        <div class="history-item__meta">${formatDate(item.createdAt)} ${providerBadge}</div>
      </div>
      <button class="history-item__copy" data-index="${i}">Копировать</button>
    </div>`;
  }).join('');

  ui.historyList.querySelectorAll('.history-item__copy').forEach(btn => {
    btn.addEventListener('click', async () => {
      const idx = parseInt(btn.dataset.index, 10);
      try {
        await navigator.clipboard.writeText(history[idx].letter);
        btn.textContent = 'Готово!';
        setTimeout(() => { btn.textContent = 'Копировать'; }, 1500);
      } catch {
        showToast('Не удалось скопировать', 'error');
      }
    });
  });
}

async function clearHistory() {
  if (!confirm('Удалить всю историю писем?')) return;

  await chrome.storage.local.remove('coverLetterHistory');
  renderHistory([]);
  showToast('История очищена', 'success');
}

// --- Utils ---

function getProviderName(id) {
  const names = { gemini: 'Google Gemini', openai: 'OpenAI', deepseek: 'DeepSeek' };
  return names[id] || id;
}

function showToast(text, type = 'success') {
  ui.toastText.textContent = text;
  ui.toast.className = `toast toast--${type}`;
  ui.toast.classList.remove('hidden');
  setTimeout(() => ui.toast.classList.add('hidden'), 3500);
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function formatDate(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString('ru-RU', {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  } catch {
    return iso;
  }
}
