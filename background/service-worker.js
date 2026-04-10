/**
 * Background service worker — центральный хаб расширения.
 * Обрабатывает сообщения от popup/content scripts,
 * выполняет вызовы к AI API (ключи не покидают background).
 */

import { generateCoverLetter, testProvider, PROVIDERS } from '../services/gemini.js';

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender)
    .then(sendResponse)
    .catch(err => sendResponse({ success: false, error: err.message }));

  return true;
});

async function handleMessage(message) {
  switch (message.type) {
    case 'GENERATE_COVER_LETTER':
      return handleGenerateLetter(message);

    case 'JOB_DATA_PARSED':
      return { success: true };

    case 'GET_JOB_DATA_FROM_TAB':
      return handleGetJobData();

    case 'CHECK_API_KEY':
      return handleCheckApiKey();

    case 'TEST_PROVIDER':
      return handleTestProvider(message);

    case 'GET_PROVIDERS':
      return { success: true, providers: PROVIDERS };

    default:
      return { success: false, error: `Unknown message type: ${message.type}` };
  }
}

/**
 * Загружает настройки провайдера из storage.
 */
async function getAIConfig() {
  const data = await chrome.storage.local.get([
    'aiProvider', 'aiModel',
    'apiKey_gemini', 'apiKey_openai', 'apiKey_deepseek',
    // Обратная совместимость со старым полем
    'geminiApiKey'
  ]);

  const provider = data.aiProvider || 'gemini';
  const model = data.aiModel || PROVIDERS[provider]?.defaultModel;

  // Ключ по провайдеру
  let apiKey = data[`apiKey_${provider}`];
  // Фолбэк на старое поле для Gemini
  if (!apiKey && provider === 'gemini') apiKey = data.geminiApiKey;

  return { provider, model, apiKey };
}

async function handleGenerateLetter(message) {
  const { jobData, profile } = message;
  const { provider, model, apiKey } = await getAIConfig();

  if (!apiKey) {
    throw new Error('API-ключ не настроен. Откройте настройки расширения.');
  }

  const result = await generateCoverLetter(apiKey, jobData, profile, provider, model);

  const history = (await getFromStorage('coverLetterHistory')) || [];
  history.unshift({
    jobTitle: jobData.title,
    company: jobData.company,
    letter: result.text,
    model: result.model,
    provider: result.provider,
    createdAt: new Date().toISOString()
  });
  if (history.length > 50) history.length = 50;
  await chrome.storage.local.set({ coverLetterHistory: history });

  return { success: true, letter: result.text, model: result.model, provider: result.provider };
}

async function handleTestProvider(message) {
  const { provider, apiKey, model } = message;
  try {
    await testProvider(provider, apiKey, model);
    return { success: true, model };
  } catch (err) {
    return { success: false, error: err.message, isRetryable: err.isRetryable };
  }
}

async function handleGetJobData() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    throw new Error('Не удалось определить активную вкладку.');
  }

  try {
    const response = await chrome.tabs.sendMessage(tab.id, { type: 'GET_JOB_DATA' });
    return response;
  } catch {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: [
        'utils/parsers.js',
        'utils/language-detector.js',
        'utils/storage.js',
        'content/index.js'
      ]
    });

    await new Promise(r => setTimeout(r, 1500));
    const retryResponse = await chrome.tabs.sendMessage(tab.id, { type: 'GET_JOB_DATA' });
    return retryResponse;
  }
}

async function handleCheckApiKey() {
  const { apiKey, provider } = await getAIConfig();
  return { success: true, hasKey: !!apiKey, provider };
}

function getFromStorage(key) {
  return new Promise(resolve => {
    chrome.storage.local.get(key, result => resolve(result[key] ?? null));
  });
}
