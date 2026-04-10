# AI Cover Letter Generator — Chrome Extension

Расширение для Chrome, которое анализирует страницы вакансий и генерирует персонализированные сопроводительные письма с помощью Google Gemini, OpenAI и DeepSeek.

## Возможности

- **Три AI-провайдера** — Google Gemini, OpenAI и DeepSeek на выбор с автоматическим fallback между моделями
- **Автоматический парсинг** — извлекает название, компанию, требования и описание вакансии
- **Мультиплатформенность** — LinkedIn, HeadHunter (hh.ru/hh.kz), Indeed, Glassdoor + универсальный парсер
- **Определение языка** — автоматически определяет язык вакансии и генерирует письмо на том же языке
- **Профиль кандидата** — сохраняет навыки, опыт и образование для персонализации
- **Выбор тона** — профессиональный, дружелюбный, уверенный или официальный
- **История писем** — хранит последние 50 сгенерированных писем
- **Понятные ошибки** — русскоязычные сообщения вместо технических ответов API
- **Безопасность** — API-ключи хранятся в `chrome.storage` и используются только в background worker

## AI-провайдеры

| Провайдер | Модели | Стоимость | Получить ключ |
|-----------|--------|-----------|---------------|
| **Google Gemini** | 2.5 Flash, 3 Flash, 2.0 Flash, 2.0 Flash Lite, 2.5 Pro | Бесплатный лимит | [aistudio.google.com](https://aistudio.google.com/apikey) |
| **OpenAI** | GPT-4.1 Nano/Mini/Full, GPT-4o, GPT-4o Mini, o4-mini | Платный | [platform.openai.com](https://platform.openai.com/api-keys) |
| **DeepSeek** | V3 (chat), R1 (reasoner) | Платный (дешёвый) | [platform.deepseek.com](https://platform.deepseek.com/api_keys) |

При ошибке квоты или недоступности модели расширение автоматически пробует следующую модель того же провайдера.

## Структура проекта

```
├── manifest.json            # Конфигурация расширения (Manifest V3)
├── background/
│   └── service-worker.js    # Background worker — маршрутизация, вызовы AI API
├── content/
│   └── index.js             # Content script — парсинг страницы вакансии
├── popup/
│   ├── popup.html           # Основной интерфейс расширения
│   ├── popup.css            # Стили popup
│   └── popup.js             # Логика popup
├── settings/
│   ├── settings.html        # Страница настроек (провайдеры, профиль, история)
│   ├── settings.css         # Стили настроек
│   └── settings.js          # Логика настроек
├── services/
│   └── gemini.js            # Единый AI-сервис (Gemini + OpenAI + DeepSeek)
├── utils/
│   ├── parsers.js           # Парсеры вакансий (LinkedIn, HH, Indeed, Glassdoor)
│   ├── language-detector.js # Определение языка текста
│   └── storage.js           # Обёртка над chrome.storage
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

## Установка

### 1. Получите API-ключ

Выберите одного из провайдеров:

- **Gemini (бесплатно):** перейдите на [Google AI Studio](https://aistudio.google.com/apikey) → создайте ключ
- **OpenAI (платный):** перейдите на [OpenAI Platform](https://platform.openai.com/api-keys) → создайте ключ → пополните баланс
- **DeepSeek (дешёвый):** перейдите на [DeepSeek Platform](https://platform.deepseek.com/api_keys) → создайте ключ → пополните баланс

### 2. Установите расширение в Chrome

1. Откройте `chrome://extensions/`
2. Включите **Режим разработчика** (переключатель в правом верхнем углу)
3. Нажмите **Загрузить распакованное расширение**
4. Выберите папку с проектом

### 3. Настройте расширение

1. Нажмите на иконку расширения → шестерёнку (настройки)
2. Выберите вкладку провайдера (Gemini / OpenAI / DeepSeek)
3. Вставьте API-ключ, выберите модель и нажмите **Сохранить**
4. Нажмите **Проверить ключ** для валидации
5. Заполните профиль кандидата (имя, навыки, опыт)

## Использование

1. Откройте страницу вакансии на LinkedIn, HH, Indeed или Glassdoor
2. Нажмите на иконку расширения
3. Данные вакансии отобразятся автоматически (или нажмите «Обновить»)
4. Выберите тон письма
5. Нажмите **Сгенерировать письмо**
6. Отредактируйте результат при необходимости
7. Нажмите **Копировать**

## Поддерживаемые платформы

| Платформа | URL | Статус |
|-----------|-----|--------|
| LinkedIn | linkedin.com/jobs/* | Полная поддержка |
| HeadHunter | hh.ru/vacancy/*, hh.kz/vacancy/* | Полная поддержка |
| Indeed | indeed.com/viewjob* | Полная поддержка |
| Glassdoor | glassdoor.com/job-listing/* | Полная поддержка |
| Другие | Любой сайт | Универсальный парсер |

## Добавление нового парсера

Для поддержки новой платформы:

1. Создайте класс, наследующий `BaseParser` в `utils/parsers.js`
2. Реализуйте методы `getTitle()`, `getCompany()`, `getDescription()` и т.д.
3. Добавьте условие в функцию `getParser()`
4. Добавьте URL-паттерн в `manifest.json` → `content_scripts.matches`

## Безопасность

- API-ключи **никогда не передаются** в content scripts
- Все вызовы к AI API происходят через background service worker
- Каждый провайдер хранит свой ключ отдельно в `chrome.storage.local`
- Расширение запрашивает минимальные разрешения

## Технологии

- Chrome Extension Manifest V3
- Vanilla JavaScript (ES2022+)
- Google Gemini API (v1beta)
- OpenAI Chat Completions API (v1)
- DeepSeek API (OpenAI-совместимый)
- chrome.storage API
- chrome.scripting API
