/**
 * Logger — переиспользуемый модуль логирования.
 * Уровни: debug, info, warn, error. Формат записи — JSON (годится для Sentry/ELK/Cloud Logging).
 * Персональные данные (телефон, email, токены) маскируются автоматически.
 */
(function (global) {
  'use strict';

  var LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };

  /** Маскирует email: user@mail.ru -> u***@mail.ru */
  function maskEmail(value) {
    return String(value).replace(/([^\s@])[^\s@]*@([^\s@]+)/g, '$1***@$2');
  }

  /** Маскирует телефон: оставляет только последние 2 цифры */
  function maskPhone(value) {
    return String(value).replace(/\+?\d[\d\s\-()]{7,}\d/g, function (m) {
      var digits = m.replace(/\D/g, '');
      return '***' + digits.slice(-2);
    });
  }

  var SENSITIVE_KEYS = /pass|token|secret|authorization/i;

  /** Рекурсивно очищает объект параметров от персональных данных */
  function sanitize(value, depth) {
    depth = depth || 0;
    if (value == null || depth > 4) return value;
    if (typeof value === 'string') return maskPhone(maskEmail(value));
    if (Array.isArray(value)) return value.map(function (v) { return sanitize(v, depth + 1); });
    if (typeof value === 'object') {
      var out = {};
      Object.keys(value).forEach(function (key) {
        out[key] = SENSITIVE_KEYS.test(key) ? '[скрыто]' : sanitize(value[key], depth + 1);
      });
      return out;
    }
    return value;
  }

  /** Превращает Error в сериализуемый объект с полным стек-трейсом */
  function serializeError(err) {
    if (!err) return undefined;
    return {
      name: err.name || 'Error',
      message: maskPhone(maskEmail(err.message || String(err))),
      stack: err.stack || ''
    };
  }

  /** Короткий ID запроса: req_8f3a2c */
  function newRequestId() {
    return 'req_' + Math.random().toString(16).slice(2, 8);
  }

  function Logger(options) {
    options = options || {};
    this.minLevel = options.level || 'debug';
    /** Куда отправлять записи дальше (например, во внешнюю систему). По умолчанию — только консоль. */
    this.transport = options.transport || null;
    this.records = []; // последние записи (для отладки и тестов)
  }

  Logger.prototype.log = function (level, message, context, err) {
    if (LEVELS[level] < LEVELS[this.minLevel]) return null;
    context = context || {};
    var record = {
      timestamp: new Date().toISOString(),
      level: level,
      message: message,
      requestId: context.requestId,
      function: context.function,
      params: sanitize(context.params)
    };
    if (err) record.error = serializeError(err);

    this.records.push(record);
    if (this.records.length > 200) this.records.shift();

    var line = JSON.stringify(record);
    var method = level === 'debug' ? 'log' : level;
    if (global.console && global.console[method]) global.console[method](line);
    if (this.transport) {
      try { this.transport(record); } catch (e) { /* логгер не должен ронять сайт */ }
    }
    return record;
  };

  ['debug', 'info', 'warn'].forEach(function (level) {
    Logger.prototype[level] = function (message, context) { return this.log(level, message, context); };
  });
  Logger.prototype.error = function (message, context, err) { return this.log('error', message, context, err); };

  Logger.newRequestId = newRequestId;
  Logger.sanitize = sanitize;
  global.Logger = Logger;
})(window);
