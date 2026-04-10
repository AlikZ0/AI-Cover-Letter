/**
 * Единый AI-сервис для генерации сопроводительных писем.
 * Поддерживает Gemini, OpenAI и DeepSeek.
 * Вызывается ТОЛЬКО из background service worker.
 */

// ============================================================
// Провайдеры и модели
// ============================================================

const PROVIDERS = {
  gemini: {
    name: 'Google Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/models',
    models: {
      'gemini-2.5-flash':       'Gemini 2.5 Flash (рекомендуемый)',
      'gemini-3-flash-preview': 'Gemini 3 Flash (preview)',
      'gemini-2.0-flash':       'Gemini 2.0 Flash',
      'gemini-2.0-flash-lite':  'Gemini 2.0 Flash Lite (быстрый)',
      'gemini-2.5-pro':         'Gemini 2.5 Pro (высшее качество)'
    },
    defaultModel: 'gemini-2.5-flash',
    fallbackOrder: [
      'gemini-2.5-flash',
      'gemini-3-flash-preview',
      'gemini-2.0-flash',
      'gemini-2.0-flash-lite',
      'gemini-2.5-pro'
    ]
  },

  openai: {
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    models: {
      'gpt-4.1-nano':  'GPT-4.1 Nano (быстрый, дешёвый)',
      'gpt-4.1-mini':  'GPT-4.1 Mini (баланс)',
      'gpt-4.1':       'GPT-4.1 (высшее качество)',
      'gpt-4o':        'GPT-4o',
      'gpt-4o-mini':   'GPT-4o Mini',
      'o4-mini':       'o4-mini (рассуждения)'
    },
    defaultModel: 'gpt-4.1-nano',
    fallbackOrder: [
      'gpt-4.1-nano',
      'gpt-4.1-mini',
      'gpt-4o-mini',
      'gpt-4o',
      'gpt-4.1'
    ]
  },

  deepseek: {
    name: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    models: {
      'deepseek-chat':     'DeepSeek V3 (рекомендуемый)',
      'deepseek-reasoner': 'DeepSeek R1 (рассуждения)'
    },
    defaultModel: 'deepseek-chat',
    fallbackOrder: [
      'deepseek-chat',
      'deepseek-reasoner'
    ]
  }
};

const TONE_DESCRIPTIONS = {
  professional: 'профессиональный и деловой тон, формальный стиль',
  friendly: 'дружелюбный и тёплый тон, но профессиональный',
  confident: 'уверенный и энергичный тон, подчёркивающий сильные стороны',
  formal: 'строго официальный тон, максимально формальный стиль'
};

// ============================================================
// Промпт
// ============================================================

function buildPrompt(jobData, profile, tone = 'professional') {
  const toneDesc = TONE_DESCRIPTIONS[tone] || TONE_DESCRIPTIONS.professional;
  const lang = jobData.detectedLanguage?.lang || 'en';

  const langInstruction = lang === 'ru'
    ? 'Напиши сопроводительное письмо на РУССКОМ языке.'
    : lang === 'de'
      ? 'Write the cover letter in GERMAN.'
      : lang === 'fr'
        ? 'Write the cover letter in FRENCH.'
        : 'Write the cover letter in ENGLISH.';

  return `You are an expert career coach and professional cover letter writer.

${langInstruction}

Generate a personalized, compelling cover letter for the following job vacancy.

=== JOB DETAILS ===
Job Title: ${jobData.title || 'Not specified'}
Company: ${jobData.company || 'Not specified'}
Location: ${jobData.location || 'Not specified'}

Description:
${jobData.description || 'Not provided'}

Requirements:
${jobData.requirements || 'See description above'}

Responsibilities:
${jobData.responsibilities || 'See description above'}

=== CANDIDATE PROFILE ===
Name: ${profile.name || 'Candidate'}
Skills: ${profile.skills || 'Not specified'}
Experience: ${profile.experience || 'Not specified'}
Education: ${profile.education || 'Not specified'}

=== INSTRUCTIONS ===
1. Use ${toneDesc}
2. The letter should be 200-350 words
3. Start with a strong opening that shows genuine interest
4. Connect the candidate's skills and experience directly to the job requirements
5. Show knowledge of the company if possible
6. End with a clear call to action
7. Sound natural and human — avoid clichés and generic phrases
8. Do NOT include placeholders like [Your Name] — use the actual candidate name
9. Do NOT include the subject line, date, or address headers — just the letter body
10. Make every sentence count — be concise but impactful`;
}

// ============================================================
// API-вызовы по провайдерам
// ============================================================

/**
 * Переводит ошибки API в понятные русскоязычные сообщения.
 */
function humanizeError(status, message, provider) {
  const lower = (message || '').toLowerCase();

  if (status === 401 || lower.includes('unauthorized') || lower.includes('invalid api key'))
    return 'Неверный API-ключ. Проверьте ключ в настройках расширения.';

  if (status === 403 || lower.includes('permission'))
    return 'Доступ запрещён. Проверьте права API-ключа.';

  if (lower.includes('insufficient') || lower.includes('balance'))
    return 'Недостаточно средств на балансе. Пополните баланс в личном кабинете провайдера.';

  if (lower.includes('quota') || lower.includes('exceeded')) {
    if (provider === 'gemini')
      return 'Бесплатный лимит Gemini исчерпан. Подождите несколько минут или смените провайдер в настройках.';
    return 'Лимит запросов исчерпан. Пополните баланс или подождите.';
  }

  if (lower.includes('billing') || lower.includes('deactivated'))
    return 'Аккаунт деактивирован. Проверьте настройки биллинга у провайдера.';

  return null;
}

/**
 * Ошибки аккаунта/оплаты — fallback на другую модель бесполезен.
 */
function isAccountError(status, message) {
  const lower = (message || '').toLowerCase();
  return status === 401 || status === 403 ||
    lower.includes('insufficient') || lower.includes('balance') ||
    lower.includes('unauthorized') || lower.includes('authentication') ||
    lower.includes('permission') || lower.includes('billing') ||
    lower.includes('deactivated') || lower.includes('quota') ||
    lower.includes('exceeded');
}

/**
 * Ошибки конкретной модели — можно попробовать другую.
 */
function isRetryableError(status, message) {
  if (isAccountError(status, message)) return false;
  const lower = (message || '').toLowerCase();
  return status === 404 || status === 503 || status === 529 ||
    lower.includes('not found') || lower.includes('not supported') ||
    lower.includes('unavailable') || lower.includes('high demand') ||
    lower.includes('overloaded') || lower.includes('server_error');
}

/** Google Gemini API */
async function callGemini(apiKey, prompt, model) {
  const url = `${PROVIDERS.gemini.baseUrl}/${model}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.8,
        topP: 0.95,
        topK: 40,
        maxOutputTokens: 2048
      },
      safetySettings: [
        { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' }
      ]
    })
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    const rawMsg = error?.error?.message || `HTTP ${response.status}`;
    const friendly = humanizeError(response.status, rawMsg, 'gemini');
    throw Object.assign(
      new Error(friendly || rawMsg),
      { isRetryable: isRetryableError(response.status, rawMsg) }
    );
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Gemini вернул пустой ответ.');
  return text.trim();
}

/**
 * OpenAI-совместимый API (OpenAI + DeepSeek).
 * DeepSeek использует тот же формат — отличается только baseUrl.
 */
async function callOpenAICompatible(baseUrl, apiKey, prompt, model) {
  const providerName = baseUrl.includes('deepseek') ? 'deepseek' : 'openai';
  const url = `${baseUrl}/chat/completions`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'system',
          content: 'You are an expert career coach and professional cover letter writer.'
        },
        { role: 'user', content: prompt }
      ],
      temperature: 0.8,
      max_tokens: 2048
    })
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    const rawMsg = error?.error?.message || `HTTP ${response.status}`;
    const friendly = humanizeError(response.status, rawMsg, providerName);
    throw Object.assign(
      new Error(friendly || rawMsg),
      { isRetryable: isRetryableError(response.status, rawMsg) }
    );
  }

  const data = await response.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error('Пустой ответ от модели. Попробуйте ещё раз.');
  return text.trim();
}

// ============================================================
// Диспетчер вызова по провайдеру
// ============================================================

async function callProvider(provider, apiKey, prompt, model) {
  switch (provider) {
    case 'gemini':
      return callGemini(apiKey, prompt, model);
    case 'openai':
      return callOpenAICompatible(PROVIDERS.openai.baseUrl, apiKey, prompt, model);
    case 'deepseek':
      return callOpenAICompatible(PROVIDERS.deepseek.baseUrl, apiKey, prompt, model);
    default:
      throw new Error(`Неизвестный провайдер: ${provider}`);
  }
}

// ============================================================
// Генерация с fallback
// ============================================================

/**
 * Главная функция генерации.
 * Пробует выбранную модель, при ошибке — fallback по списку.
 */
async function generateCoverLetter(apiKey, jobData, profile, provider, preferredModel) {
  const tone = profile.tone || 'professional';
  const prompt = buildPrompt(jobData, profile, tone);

  const config = PROVIDERS[provider];
  if (!config) throw new Error(`Неизвестный провайдер: ${provider}`);

  const startModel = preferredModel || config.defaultModel;
  const modelsToTry = [startModel, ...config.fallbackOrder.filter(m => m !== startModel)];
  let lastError;

  for (const model of modelsToTry) {
    try {
      const result = await callProvider(provider, apiKey, prompt, model);
      return { text: result, model, provider };
    } catch (err) {
      lastError = err;
      if (err.isRetryable) {
        console.warn(`${model} недоступна, пробую следующую...`);
        continue;
      }
      throw err;
    }
  }

  throw lastError;
}

/**
 * Тестовый вызов — проверка ключа.
 * Отправляет минимальный запрос для валидации.
 */
async function testProvider(provider, apiKey, model) {
  const prompt = 'Respond with just "OK"';
  return callProvider(provider, apiKey, prompt, model);
}

export {
  generateCoverLetter, testProvider, buildPrompt,
  PROVIDERS, TONE_DESCRIPTIONS
};
