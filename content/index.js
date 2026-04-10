/**
 * Content script — точка входа.
 * Запускается на страницах вакансий, парсит DOM и отправляет
 * структурированные данные в background/popup по запросу.
 */

(async function () {
  'use strict';

  // Ждём полной загрузки динамического контента (SPA-платформы)
  await waitForContent();

  const parser = globalThis.JobParsers.getParser();
  const jobData = parser.parse();

  // Определяем язык вакансии
  const fullText = [jobData.description, jobData.requirements, jobData.responsibilities]
    .filter(Boolean)
    .join(' ');
  const langResult = globalThis.LanguageDetector.detectLanguage(fullText);
  jobData.detectedLanguage = langResult;

  // Сохраняем данные для popup
  await globalThis.AppStorage.saveJobData(jobData);

  // Уведомляем background что данные готовы
  chrome.runtime.sendMessage({
    type: 'JOB_DATA_PARSED',
    data: jobData
  });

  // Обработка запросов от popup
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'GET_JOB_DATA') {
      // Парсим заново — страница могла измениться
      const freshData = parser.parse();
      const text = [freshData.description, freshData.requirements, freshData.responsibilities]
        .filter(Boolean)
        .join(' ');
      freshData.detectedLanguage = globalThis.LanguageDetector.detectLanguage(text);
      sendResponse({ success: true, data: freshData });
    }
    return true; // Асинхронный ответ
  });

  /**
   * Ожидание загрузки контента для SPA.
   * Ждём появления ключевых элементов или таймаут 5с.
   */
  function waitForContent() {
    return new Promise(resolve => {
      const selectors = [
        // LinkedIn
        '.jobs-description__content',
        '.job-details-jobs-unified-top-card__job-title',
        // HH
        '[data-qa="vacancy-title"]',
        '[data-qa="vacancy-description"]',
        // Indeed
        '#jobDescriptionText',
        '.jobsearch-JobInfoHeader-title',
        // Glassdoor
        '[data-test="jobTitle"]',
        // Fallback
        'h1'
      ];

      // Если уже есть заголовок — контент загружен
      if (selectors.some(s => document.querySelector(s))) {
        return resolve();
      }

      const observer = new MutationObserver(() => {
        if (selectors.some(s => document.querySelector(s))) {
          observer.disconnect();
          resolve();
        }
      });

      observer.observe(document.body, { childList: true, subtree: true });

      // Таймаут-страховка
      setTimeout(() => {
        observer.disconnect();
        resolve();
      }, 5000);
    });
  }
})();
