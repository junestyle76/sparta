// 타이머 시간 환산·검증·표시 형식과 저장값 입출력을 담는 순수 로직 (DOM 을 참조하지 않는다)
(function (global) {
  'use strict';

  var MAX_DAYS = 365;
  var MAX_SECONDS = MAX_DAYS * 86400;
  var DEFAULT_SECONDS = 50 * 60;
  var STORAGE_KEY = 'flipclock.timerSeconds';
  // 파이썬 버전의 timer_settings._LIMITS 와 같은 순서·범위를 유지한다.
  var LIMITS = [['일', MAX_DAYS], ['시', 23], ['분', 59], ['초', 59]];

  function toSeconds(days, hours, minutes, seconds) {
    return days * 86400 + hours * 3600 + minutes * 60 + seconds;
  }

  function splitDuration(totalSeconds) {
    var total = Math.max(0, Math.trunc(totalSeconds));
    return [
      Math.floor(total / 86400),
      Math.floor((total % 86400) / 3600),
      Math.floor((total % 3600) / 60),
      total % 60
    ];
  }

  function pad(value) {
    return String(value).padStart(2, '0');
  }

  /** 1일 미만은 HH:MM:SS, 1일 이상은 '3d 04:05:06' 형태로 돌려준다. */
  function formatDuration(totalSeconds) {
    var parts = splitDuration(totalSeconds);
    var body = pad(parts[1]) + ':' + pad(parts[2]) + ':' + pad(parts[3]);
    return parts[0] ? parts[0] + 'd ' + body : body;
  }

  /** 검증 결과와 실패 사유를 돌려준다. 성공이면 message 는 빈 문자열. */
  function validate(days, hours, minutes, seconds) {
    var values = [days, hours, minutes, seconds];
    for (var i = 0; i < LIMITS.length; i++) {
      var name = LIMITS[i][0];
      var limit = LIMITS[i][1];
      if (!(values[i] >= 0 && values[i] <= limit)) {
        return { ok: false, message: name + ' 값은 0~' + limit + ' 범위여야 합니다 (입력: ' + values[i] + ').' };
      }
    }

    var total = toSeconds(days, hours, minutes, seconds);
    if (total <= 0) {
      return { ok: false, message: '타이머는 최소 1초 이상이어야 합니다.' };
    }
    if (total > MAX_SECONDS) {
      return { ok: false, message: '타이머는 최대 ' + MAX_DAYS + '일까지 지정할 수 있습니다 (입력: ' + formatDuration(total) + ').' };
    }
    return { ok: true, message: '' };
  }

  /** 입력 칸의 문자열 4개를 검사해 총 초로 바꾼다. 실패하면 seconds 가 null. */
  function parseFields(rawValues) {
    var values = [];
    for (var i = 0; i < LIMITS.length; i++) {
      var text = String(rawValues[i] === undefined || rawValues[i] === null ? '' : rawValues[i]).trim();
      var value = Number(text);
      if (text === '' || !Number.isInteger(value)) {
        return { ok: false, message: LIMITS[i][0] + " 값이 숫자가 아닙니다 (입력: '" + text + "').", seconds: null };
      }
      values.push(value);
    }

    var result = validate(values[0], values[1], values[2], values[3]);
    return { ok: result.ok, message: result.message, seconds: result.ok ? toSeconds.apply(null, values) : null };
  }

  /** 저장된 타이머 초를 읽는다. 값이 없거나 잘못되면 기본값 50분. */
  function loadSeconds(storage) {
    var raw;
    try {
      raw = storage ? storage.getItem(STORAGE_KEY) : null;
    } catch (err) {
      console.warn('[FlipClock] 저장소를 읽을 수 없어 기본값 50분을 사용합니다:', err.message);
      return DEFAULT_SECONDS;
    }
    if (raw === null || raw === undefined) {
      return DEFAULT_SECONDS;
    }

    var seconds = Number(raw);
    if (!Number.isInteger(seconds)) {
      console.warn("[FlipClock] 저장된 값이 정수가 아니어서 기본값 50분을 사용합니다 (값: '" + raw + "').");
      return DEFAULT_SECONDS;
    }

    var parts = splitDuration(seconds);
    var result = validate(parts[0], parts[1], parts[2], parts[3]);
    if (!result.ok) {
      console.warn('[FlipClock] 저장된 타이머 값이 올바르지 않아 기본값 50분을 사용합니다:', result.message);
      return DEFAULT_SECONDS;
    }
    return seconds;
  }

  function saveSeconds(totalSeconds, storage) {
    try {
      if (storage) {
        storage.setItem(STORAGE_KEY, String(Math.trunc(totalSeconds)));
        return true;
      }
    } catch (err) {
      console.warn('[FlipClock] 저장에 실패했습니다 (설정은 이번 세션에만 적용됩니다):', err.message);
    }
    return false;
  }

  global.FlipTimer = {
    MAX_DAYS: MAX_DAYS,
    MAX_SECONDS: MAX_SECONDS,
    DEFAULT_SECONDS: DEFAULT_SECONDS,
    STORAGE_KEY: STORAGE_KEY,
    LIMITS: LIMITS,
    toSeconds: toSeconds,
    splitDuration: splitDuration,
    formatDuration: formatDuration,
    validate: validate,
    parseFields: parseFields,
    loadSeconds: loadSeconds,
    saveSeconds: saveSeconds
  };

  // node 로 로직만 검증할 때를 위한 내보내기. 브라우저에서는 무시된다.
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = global.FlipTimer;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
