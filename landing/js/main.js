/**
 * Основной скрипт лендинга: меню, FAQ-доступность, форма заявки.
 * Все настройки — в объекте CONFIG ниже.
 */
(function () {
  'use strict';

  var CONFIG = {
    // Адрес, куда отправляется заявка (например, Formspree: https://formspree.io/f/XXXX).
    // Пока пусто — форма покажет подсказку написать в мессенджер.
    formEndpoint: '',
    // Куда вести, если форма не подключена
    fallbackContactUrl: 'https://t.me/your_username', // ЗАМЕНИТЕ на свой Telegram
    logLevel: 'debug'
  };

  var logger = new Logger({ level: CONFIG.logLevel });
  window.__logger = logger; // для проверки в консоли браузера

  /* ---------- Мобильное меню ---------- */
  function initMenu() {
    var btn = document.querySelector('.nav__toggle');
    var menu = document.getElementById('menu');
    if (!btn || !menu) return;
    btn.addEventListener('click', function () {
      var open = menu.classList.toggle('is-open');
      btn.setAttribute('aria-expanded', String(open));
    });
    menu.addEventListener('click', function (e) {
      if (e.target.tagName === 'A') {
        menu.classList.remove('is-open');
        btn.setAttribute('aria-expanded', 'false');
      }
    });
  }

  /* ---------- Форма заявки ---------- */
  function setError(field, text) {
    var box = document.querySelector('[data-error-for="' + field.name + '"]');
    if (box) box.textContent = text || '';
    field.setAttribute('aria-invalid', text ? 'true' : 'false');
  }

  /** Проверка формы. Возвращает объект ошибок (пустой — всё хорошо). */
  function validate(form) {
    var errors = {};
    var name = form.elements.name;
    var contact = form.elements.contact;
    var consent = form.elements.consent;

    if (name.value.trim().length < 2) errors.name = 'Введите имя (минимум 2 буквы)';

    var c = contact.value.trim();
    var isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(c);
    var isPhone = c.replace(/\D/g, '').length >= 10;
    var isTg = /^@[A-Za-z0-9_]{4,}$/.test(c);
    if (!(isEmail || isPhone || isTg)) errors.contact = 'Укажите телефон, @telegram или email';

    if (!consent.checked) errors.consent = 'Нужно согласие на обработку данных';
    return errors;
  }

  function submitLeadForm(form) {
    var ctx = { requestId: Logger.newRequestId(), function: 'submitLeadForm' };
    var status = document.getElementById('form-status');
    var button = form.querySelector('button[type="submit"]');

    var fields = ['name', 'contact', 'consent'];
    var errors = validate(form);
    fields.forEach(function (f) { setError(form.elements[f], errors[f]); });

    if (Object.keys(errors).length) {
      logger.warn('Форма не прошла проверку', {
        requestId: ctx.requestId, function: ctx.function,
        params: { formId: 'landing-main', invalidFields: Object.keys(errors) }
      });
      status.className = 'form__status is-error';
      status.textContent = 'Проверьте поля, выделенные красным.';
      return Promise.resolve(false);
    }

    var payload = {
      name: form.elements.name.value.trim(),
      contact: form.elements.contact.value.trim(),
      comment: form.elements.comment.value.trim()
    };
    var params = { formId: 'landing-main', contact: payload.contact };
    logger.info('Отправка заявки', { requestId: ctx.requestId, function: ctx.function, params: params });

    if (!CONFIG.formEndpoint) {
      logger.warn('Адрес отправки формы не задан (CONFIG.formEndpoint)', {
        requestId: ctx.requestId, function: ctx.function, params: { formId: 'landing-main' }
      });
      status.className = 'form__status is-error';
      status.innerHTML = 'Форма пока не подключена. Напишите нам в <a href="' +
        CONFIG.fallbackContactUrl + '">Telegram</a>.';
      return Promise.resolve(false);
    }

    button.disabled = true;
    return fetch(CONFIG.formEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(payload)
    }).then(function (res) {
      if (!res.ok) throw new Error('Сервер ответил статусом ' + res.status);
      logger.info('Заявка отправлена', { requestId: ctx.requestId, function: ctx.function, params: params });
      status.className = 'form__status is-ok';
      status.textContent = 'Спасибо! Заявка отправлена, мы свяжемся с вами в ближайшее время.';
      form.reset();
      return true;
    }).catch(function (err) {
      logger.error('Не удалось отправить форму заявки', {
        requestId: ctx.requestId, function: ctx.function, params: params
      }, err);
      status.className = 'form__status is-error';
      status.innerHTML = 'Не получилось отправить. Напишите нам в <a href="' +
        CONFIG.fallbackContactUrl + '">Telegram</a>.';
      return false;
    }).then(function (ok) {
      button.disabled = false;
      return ok;
    });
  }

  function initForm() {
    var form = document.getElementById('lead-form');
    if (!form) return;
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      submitLeadForm(form);
    });
  }

  /* ---------- Глобальные ошибки ---------- */
  window.addEventListener('error', function (e) {
    logger.error('Необработанная ошибка', { function: 'window.onerror', params: { file: e.filename, line: e.lineno } }, e.error);
  });
  window.addEventListener('unhandledrejection', function (e) {
    logger.error('Необработанный промис', { function: 'unhandledrejection' }, e.reason instanceof Error ? e.reason : new Error(String(e.reason)));
  });

  document.addEventListener('DOMContentLoaded', function () {
    document.getElementById('year').textContent = new Date().getFullYear();
    initMenu();
    initForm();
    logger.debug('Страница инициализирована', { function: 'init' });
  });
})();
