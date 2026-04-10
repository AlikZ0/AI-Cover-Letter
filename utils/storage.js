/**
 * Обёртка над chrome.storage.local с async/await интерфейсом.
 * Централизует работу с хранилищем расширения.
 */

const Storage = {
  async get(key) {
    const result = await chrome.storage.local.get(key);
    return result[key] ?? null;
  },

  async set(key, value) {
    await chrome.storage.local.set({ [key]: value });
  },

  async getMultiple(keys) {
    return chrome.storage.local.get(keys);
  },

  async remove(key) {
    await chrome.storage.local.remove(key);
  },

  // --- Профиль пользователя ---

  async getProfile() {
    return (await this.get('userProfile')) || {
      name: '',
      skills: '',
      experience: '',
      education: '',
      tone: 'professional'
    };
  },

  async saveProfile(profile) {
    await this.set('userProfile', profile);
  },

  // --- API ключ ---

  async getApiKey() {
    return this.get('geminiApiKey');
  },

  async saveApiKey(key) {
    await this.set('geminiApiKey', key);
  },

  // --- Данные вакансии из последнего парсинга ---

  async getLastJobData() {
    return this.get('lastJobData');
  },

  async saveJobData(data) {
    await this.set('lastJobData', data);
  },

  // --- История писем ---

  async getHistory() {
    return (await this.get('coverLetterHistory')) || [];
  },

  async addToHistory(entry) {
    const history = await this.getHistory();
    history.unshift({
      ...entry,
      createdAt: new Date().toISOString()
    });
    // Храним последние 50 записей
    if (history.length > 50) history.length = 50;
    await this.set('coverLetterHistory', history);
  }
};

if (typeof globalThis !== 'undefined') {
  globalThis.AppStorage = Storage;
}
