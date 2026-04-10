/**
 * Popup — основная логика интерфейса.
 * Управляет отображением данных вакансии,
 * генерацией письма и взаимодействием с пользователем.
 */

document.addEventListener('DOMContentLoaded', init);

const LANG_NAMES = {
  ru: 'Русский',
  en: 'English',
  de: 'Deutsch',
  fr: 'Français'
};

// Кеш DOM-элементов
const ui = {};

function init() {
  cacheElements();
  bindEvents();
  checkApiKey();
  loadJobData();
}

function cacheElements() {
  const ids = [
    'statusBar', 'statusText', 'noApiKeyWarning', 'openSettingsLink',
    'settingsBtn', 'refreshBtn', 'jobSection', 'jobDataEmpty',
    'jobDataContent', 'jobTitle', 'jobCompany', 'jobLocation',
    'jobLanguage', 'jobSalary', 'salaryField', 'jobDescription',
    'toneSection', 'generateSection', 'generateBtn', 'loadingSection',
    'resultSection', 'resultText', 'copyBtn', 'regenerateBtn'
  ];
  for (const id of ids) {
    ui[id] = document.getElementById(id);
  }
}

function bindEvents() {
  ui.settingsBtn.addEventListener('click', openSettings);
  ui.openSettingsLink?.addEventListener('click', e => {
    e.preventDefault();
    openSettings();
  });
  ui.refreshBtn.addEventListener('click', refreshJobData);
  ui.generateBtn.addEventListener('click', generateLetter);
  ui.copyBtn.addEventListener('click', copyToClipboard);
  ui.regenerateBtn.addEventListener('click', generateLetter);
}

function openSettings() {
  chrome.runtime.openOptionsPage();
}

// --- API Key ---

async function checkApiKey() {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'CHECK_API_KEY' });
    if (!response?.hasKey) {
      ui.noApiKeyWarning.classList.remove('hidden');
    }
  } catch {
    ui.noApiKeyWarning.classList.remove('hidden');
  }
}

// --- Job Data ---

let currentJobData = null;

async function loadJobData() {
  // Сначала пробуем из storage (от content script)
  const stored = await chrome.storage.local.get('lastJobData');
  if (stored.lastJobData?.title) {
    displayJobData(stored.lastJobData);
    return;
  }
  // Иначе — запрашиваем напрямую
  refreshJobData();
}

async function refreshJobData() {
  showStatus('Анализ страницы...', 'info');
  ui.refreshBtn.disabled = true;

  try {
    const response = await chrome.runtime.sendMessage({ type: 'GET_JOB_DATA_FROM_TAB' });

    if (response?.success && response.data?.title) {
      displayJobData(response.data);
      showStatus('Данные обновлены', 'success');
      setTimeout(hideStatus, 2000);
    } else {
      showEmptyState();
      showStatus('Не удалось извлечь данные. Убедитесь, что открыта страница вакансии.', 'error');
    }
  } catch (err) {
    showEmptyState();
    showStatus('Ошибка: ' + err.message, 'error');
  } finally {
    ui.refreshBtn.disabled = false;
  }
}

function displayJobData(data) {
  currentJobData = data;

  ui.jobTitle.textContent = data.title || '—';
  ui.jobCompany.textContent = data.company || '—';
  ui.jobLocation.textContent = data.location || '—';

  const langCode = data.detectedLanguage?.lang || 'en';
  ui.jobLanguage.textContent = LANG_NAMES[langCode] || langCode;

  if (data.salary) {
    ui.jobSalary.textContent = data.salary;
    ui.salaryField.classList.remove('hidden');
  } else {
    ui.salaryField.classList.add('hidden');
  }

  // Ограничиваем описание до 500 символов для превью
  const desc = data.description || '';
  ui.jobDescription.textContent = desc.length > 500
    ? desc.substring(0, 500) + '...'
    : desc;

  ui.jobDataEmpty.classList.add('hidden');
  ui.jobDataContent.classList.remove('hidden');
  ui.toneSection.classList.remove('hidden');
  ui.generateSection.classList.remove('hidden');
}

function showEmptyState() {
  ui.jobDataContent.classList.add('hidden');
  ui.toneSection.classList.add('hidden');
  ui.generateSection.classList.add('hidden');
  ui.jobDataEmpty.classList.remove('hidden');
}

// --- Generation ---

async function generateLetter() {
  if (!currentJobData) {
    showStatus('Сначала загрузите данные вакансии', 'error');
    return;
  }

  const profile = await getProfile();
  const tone = document.querySelector('input[name="tone"]:checked')?.value || 'professional';
  profile.tone = tone;

  // UI: показываем загрузку
  ui.generateSection.classList.add('hidden');
  ui.resultSection.classList.add('hidden');
  ui.loadingSection.classList.remove('hidden');
  hideStatus();

  try {
    const response = await chrome.runtime.sendMessage({
      type: 'GENERATE_COVER_LETTER',
      jobData: currentJobData,
      profile
    });

    if (response?.success && response.letter) {
      ui.resultText.value = response.letter;
      ui.resultSection.classList.remove('hidden');
      const providerName = response.provider || '';
      const modelNote = response.model ? ` (${providerName} / ${response.model})` : '';
      showStatus('Письмо сгенерировано!' + modelNote, 'success');
      setTimeout(hideStatus, 4000);
    } else {
      throw new Error(response?.error || 'Неизвестная ошибка');
    }
  } catch (err) {
    showStatus('Ошибка: ' + err.message, 'error');
    ui.generateSection.classList.remove('hidden');
  } finally {
    ui.loadingSection.classList.add('hidden');
  }
}

async function getProfile() {
  const stored = await chrome.storage.local.get('userProfile');
  return stored.userProfile || {
    name: 'Кандидат',
    skills: 'JavaScript, Python, React',
    experience: '3 года опыта разработки',
    education: '',
    tone: 'professional'
  };
}

// --- Copy ---

async function copyToClipboard() {
  const text = ui.resultText.value;
  if (!text) return;

  try {
    await navigator.clipboard.writeText(text);
    ui.copyBtn.classList.add('btn--success');
    ui.copyBtn.querySelector('span').textContent = 'Скопировано!';
    setTimeout(() => {
      ui.copyBtn.classList.remove('btn--success');
      ui.copyBtn.querySelector('span').textContent = 'Копировать';
    }, 2000);
  } catch {
    // Fallback для старых браузеров
    ui.resultText.select();
    document.execCommand('copy');
    showStatus('Скопировано в буфер обмена', 'success');
    setTimeout(hideStatus, 2000);
  }
}

// --- Status ---

function showStatus(text, type = 'info') {
  ui.statusText.textContent = text;
  ui.statusBar.className = `status-bar status-bar--${type}`;
  ui.statusBar.classList.remove('hidden');
}

function hideStatus() {
  ui.statusBar.classList.add('hidden');
}
