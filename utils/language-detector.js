/**
 * Определение языка текста на основе частотного анализа символов и стоп-слов.
 * Используется для адаптации языка сопроводительного письма к языку вакансии.
 */

const LANGUAGE_PATTERNS = {
  ru: {
    // Кириллические символы
    charPattern: /[а-яёА-ЯЁ]/g,
    stopWords: [
      'опыт', 'работа', 'требования', 'обязанности', 'компания',
      'знание', 'навыки', 'разработка', 'должен', 'задачи'
    ],
    name: 'Russian'
  },
  en: {
    charPattern: /[a-zA-Z]/g,
    stopWords: [
      'experience', 'requirements', 'responsibilities', 'company',
      'skills', 'development', 'looking', 'team', 'ability', 'work'
    ],
    name: 'English'
  },
  de: {
    charPattern: /[a-zA-ZäöüßÄÖÜ]/g,
    stopWords: [
      'erfahrung', 'anforderungen', 'aufgaben', 'unternehmen',
      'kenntnisse', 'entwicklung', 'arbeiten', 'berufserfahrung'
    ],
    name: 'German'
  },
  fr: {
    charPattern: /[a-zA-ZàâéèêëïîôùûüÿçÀÂÉÈÊËÏÎÔÙÛÜŸÇ]/g,
    stopWords: [
      'expérience', 'exigences', 'responsabilités', 'entreprise',
      'compétences', 'développement', 'poste', 'travail'
    ],
    name: 'French'
  }
};

/**
 * Определяет язык текста, возвращая код языка и уровень уверенности.
 * Приоритет: если найдена кириллица — скорее всего русский.
 */
function detectLanguage(text) {
  if (!text || text.length < 20) return { lang: 'en', confidence: 0, name: 'English' };

  const lower = text.toLowerCase();
  const scores = {};

  // Сначала проверяем кириллицу — однозначный маркер
  const cyrillicMatches = (lower.match(LANGUAGE_PATTERNS.ru.charPattern) || []).length;
  const totalChars = lower.replace(/\s/g, '').length;

  if (totalChars > 0 && cyrillicMatches / totalChars > 0.3) {
    return { lang: 'ru', confidence: 0.95, name: 'Russian' };
  }

  // Подсчёт стоп-слов для оставшихся языков
  for (const [lang, config] of Object.entries(LANGUAGE_PATTERNS)) {
    if (lang === 'ru') continue;

    let score = 0;
    for (const word of config.stopWords) {
      const regex = new RegExp(`\\b${word}\\b`, 'gi');
      const matches = lower.match(regex);
      if (matches) score += matches.length;
    }
    scores[lang] = score;
  }

  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const [topLang, topScore] = sorted[0] || ['en', 0];
  const confidence = Math.min(topScore / 10, 1);

  return {
    lang: topLang,
    confidence,
    name: LANGUAGE_PATTERNS[topLang]?.name || 'English'
  };
}

if (typeof globalThis !== 'undefined') {
  globalThis.LanguageDetector = { detectLanguage, LANGUAGE_PATTERNS };
}
