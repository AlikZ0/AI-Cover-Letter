/**
 * Базовый класс парсера вакансий.
 * Все платформенные парсеры наследуются от него,
 * обеспечивая единый интерфейс извлечения данных.
 */
class BaseParser {
  constructor(platform) {
    this.platform = platform;
  }

  parse() {
    return {
      platform: this.platform,
      title: this.getTitle(),
      company: this.getCompany(),
      location: this.getLocation(),
      requirements: this.getRequirements(),
      responsibilities: this.getResponsibilities(),
      description: this.getDescription(),
      salary: this.getSalary(),
      url: window.location.href,
      parsedAt: new Date().toISOString()
    };
  }

  getTitle() { return ''; }
  getCompany() { return ''; }
  getLocation() { return ''; }
  getRequirements() { return ''; }
  getResponsibilities() { return ''; }
  getDescription() { return ''; }
  getSalary() { return ''; }

  /** Извлекает текст из элемента, найденного по селектору */
  queryText(selector, root = document) {
    const el = root.querySelector(selector);
    return el ? el.textContent.trim() : '';
  }

  /** Извлекает текст из всех элементов по селектору и объединяет */
  queryAllText(selector, root = document, separator = '\n') {
    const elements = root.querySelectorAll(selector);
    return Array.from(elements)
      .map(el => el.textContent.trim())
      .filter(Boolean)
      .join(separator);
  }

  /**
   * Ищет секцию по ключевым словам в заголовке
   * и возвращает текст следующего блока.
   */
  findSectionByHeading(keywords, root = document) {
    const headings = root.querySelectorAll('h1, h2, h3, h4, h5, h6, strong, b');
    for (const heading of headings) {
      const text = heading.textContent.toLowerCase();
      if (keywords.some(kw => text.includes(kw))) {
        const sibling = heading.nextElementSibling;
        if (sibling) return sibling.textContent.trim();

        const parent = heading.parentElement;
        if (parent && parent.nextElementSibling) {
          return parent.nextElementSibling.textContent.trim();
        }
      }
    }
    return '';
  }
}


class LinkedInParser extends BaseParser {
  constructor() { super('linkedin'); }

  getTitle() {
    return this.queryText('.job-details-jobs-unified-top-card__job-title h1') ||
           this.queryText('.t-24.job-details-jobs-unified-top-card__job-title') ||
           this.queryText('.topcard__title') ||
           this.queryText('h1.top-card-layout__title') ||
           this.queryText('h1');
  }

  getCompany() {
    return this.queryText('.job-details-jobs-unified-top-card__company-name a') ||
           this.queryText('.job-details-jobs-unified-top-card__company-name') ||
           this.queryText('.topcard__org-name-link') ||
           this.queryText('a.topcard__org-name-link');
  }

  getLocation() {
    return this.queryText('.job-details-jobs-unified-top-card__bullet') ||
           this.queryText('.topcard__flavor--bullet');
  }

  getDescription() {
    const container = document.querySelector('.jobs-description__content') ||
                      document.querySelector('.jobs-box__html-content') ||
                      document.querySelector('.description__text') ||
                      document.querySelector('.show-more-less-html__markup');
    return container ? container.textContent.trim() : '';
  }

  getRequirements() {
    return this.findSectionByHeading([
      'requirements', 'qualifications', 'требования',
      'what you need', 'what we expect', 'skills'
    ]);
  }

  getResponsibilities() {
    return this.findSectionByHeading([
      'responsibilities', 'обязанности', 'what you will do',
      'what you\'ll do', 'role', 'задачи'
    ]);
  }

  getSalary() {
    return this.queryText('.salary-main-rail__data-body') ||
           this.queryText('.compensation__salary');
  }
}


class HeadHunterParser extends BaseParser {
  constructor() { super('headhunter'); }

  getTitle() {
    return this.queryText('[data-qa="vacancy-title"]') ||
           this.queryText('.vacancy-title h1') ||
           this.queryText('h1.bloko-header-section-1');
  }

  getCompany() {
    return this.queryText('[data-qa="vacancy-company-name"]') ||
           this.queryText('.vacancy-company-name span') ||
           this.queryText('.bloko-header-section-2 span');
  }

  getLocation() {
    return this.queryText('[data-qa="vacancy-view-location"]') ||
           this.queryText('[data-qa="vacancy-view-raw-address"]');
  }

  getDescription() {
    const container = document.querySelector('[data-qa="vacancy-description"]') ||
                      document.querySelector('.vacancy-section');
    return container ? container.textContent.trim() : '';
  }

  getRequirements() {
    // HH часто структурирует через блоки с data-qa
    const desc = document.querySelector('[data-qa="vacancy-description"]');
    if (!desc) return '';

    return this.findSectionByHeading([
      'требования', 'ожидаем', 'от кандидата', 'requirements',
      'нам важно', 'мы ожидаем', 'что мы ждём', 'навыки'
    ], desc);
  }

  getResponsibilities() {
    const desc = document.querySelector('[data-qa="vacancy-description"]');
    if (!desc) return '';

    return this.findSectionByHeading([
      'обязанности', 'задачи', 'чем предстоит заниматься',
      'что нужно делать', 'responsibilities', 'вы будете'
    ], desc);
  }

  getSalary() {
    return this.queryText('[data-qa="vacancy-salary"]') ||
           this.queryText('.vacancy-salary-compensation-type-net') ||
           this.queryText('[data-qa="vacancy-salary-compensation-type-net"]');
  }
}


class IndeedParser extends BaseParser {
  constructor() { super('indeed'); }

  getTitle() {
    return this.queryText('.jobsearch-JobInfoHeader-title') ||
           this.queryText('h1.icl-u-xs-mb--xs') ||
           this.queryText('[data-testid="jobsearch-JobInfoHeader-title"]') ||
           this.queryText('h1');
  }

  getCompany() {
    return this.queryText('[data-testid="inlineHeader-companyName"]') ||
           this.queryText('.jobsearch-InlineCompanyRating-companyHeader a') ||
           this.queryText('[data-company-name]');
  }

  getLocation() {
    return this.queryText('[data-testid="inlineHeader-companyLocation"]') ||
           this.queryText('[data-testid="jobsearch-JobInfoHeader-companyLocation"]') ||
           this.queryText('.jobsearch-InlineCompanyRating > div:last-child');
  }

  getDescription() {
    const container = document.querySelector('#jobDescriptionText') ||
                      document.querySelector('.jobsearch-jobDescriptionText');
    return container ? container.textContent.trim() : '';
  }

  getRequirements() {
    const desc = document.querySelector('#jobDescriptionText') ||
                 document.querySelector('.jobsearch-jobDescriptionText');
    if (!desc) return '';

    return this.findSectionByHeading([
      'requirements', 'qualifications', 'требования',
      'what you need', 'skills', 'who you are'
    ], desc);
  }

  getResponsibilities() {
    const desc = document.querySelector('#jobDescriptionText') ||
                 document.querySelector('.jobsearch-jobDescriptionText');
    if (!desc) return '';

    return this.findSectionByHeading([
      'responsibilities', 'duties', 'обязанности',
      'what you will do', 'role description'
    ], desc);
  }

  getSalary() {
    return this.queryText('#salaryInfoAndJobType span') ||
           this.queryText('[data-testid="attribute_snippet_testid"]');
  }
}


class GlassdoorParser extends BaseParser {
  constructor() { super('glassdoor'); }

  getTitle() {
    return this.queryText('[data-test="jobTitle"]') ||
           this.queryText('.css-1vg6q84.e1tk4kwz5') ||
           this.queryText('h1');
  }

  getCompany() {
    return this.queryText('[data-test="employerName"]') ||
           this.queryText('.css-87uc0g.e1tk4kwz1');
  }

  getLocation() {
    return this.queryText('[data-test="location"]') ||
           this.queryText('.css-56kyx5.e1tk4kwz0');
  }

  getDescription() {
    const container = document.querySelector('.jobDescriptionContent') ||
                      document.querySelector('[data-test="jobDescriptionContent"]') ||
                      document.querySelector('.desc');
    return container ? container.textContent.trim() : '';
  }

  getRequirements() {
    return this.findSectionByHeading([
      'requirements', 'qualifications', 'skills', 'требования'
    ]);
  }

  getResponsibilities() {
    return this.findSectionByHeading([
      'responsibilities', 'duties', 'обязанности', 'what you will do'
    ]);
  }
}


/**
 * Универсальный парсер — фолбэк для неизвестных платформ.
 * Пытается извлечь данные из типичных HTML-структур.
 */
class GenericParser extends BaseParser {
  constructor() { super('generic'); }

  getTitle() {
    return this.queryText('h1') || document.title;
  }

  getCompany() {
    return this.findSectionByHeading(['company', 'компания', 'employer', 'работодатель']);
  }

  getDescription() {
    const selectors = [
      '[class*="description"]',
      '[class*="vacancy"]',
      '[class*="job-details"]',
      'article',
      'main'
    ];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el && el.textContent.trim().length > 100) {
        return el.textContent.trim();
      }
    }
    return '';
  }

  getRequirements() {
    return this.findSectionByHeading([
      'requirements', 'qualifications', 'требования', 'навыки', 'skills'
    ]);
  }

  getResponsibilities() {
    return this.findSectionByHeading([
      'responsibilities', 'обязанности', 'duties', 'задачи'
    ]);
  }
}


/**
 * Фабрика парсеров — выбирает нужный парсер по URL.
 * Легко расширяется добавлением новых платформ.
 */
function getParser() {
  const host = window.location.hostname;

  if (host.includes('linkedin.com')) return new LinkedInParser();
  if (host.includes('hh.ru') || host.includes('hh.kz')) return new HeadHunterParser();
  if (host.includes('indeed.com')) return new IndeedParser();
  if (host.includes('glassdoor.com')) return new GlassdoorParser();

  return new GenericParser();
}

// ESM не поддерживается в content scripts MV3 — экспорт через globalThis
if (typeof globalThis !== 'undefined') {
  globalThis.JobParsers = {
    getParser,
    BaseParser,
    LinkedInParser,
    HeadHunterParser,
    IndeedParser,
    GlassdoorParser,
    GenericParser
  };
}
