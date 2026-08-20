// 화면 조립과 시계·타이머 갱신 루프 (시간 계산/검증은 timer_core.js 의 FlipTimer 사용)
(function () {
  'use strict';

  var T = window.FlipTimer;
  var WEEKDAYS = ['월', '화', '수', '목', '금', '토', '일'];
  var TICK_MS = 100;
  var CARD_COUNT = 6;
  var COLON_AFTER = [1, 3];

  var elDate = document.getElementById('date');
  var elClock = document.getElementById('clock');
  var elTimer = document.getElementById('timer');
  var btnStart = document.getElementById('btn-start');
  var btnReset = document.getElementById('btn-reset');
  var btnSettings = document.getElementById('btn-settings');
  var dialog = document.getElementById('settings');
  var form = document.getElementById('settings-form');
  var elError = document.getElementById('settings-error');
  var btnCancel = document.getElementById('btn-cancel');
  var fields = [
    document.getElementById('f-days'),
    document.getElementById('f-hours'),
    document.getElementById('f-minutes'),
    document.getElementById('f-seconds')
  ];

  var storage = (function () {
    try {
      var probe = '__flipclock__';
      window.localStorage.setItem(probe, '1');
      window.localStorage.removeItem(probe);
      return window.localStorage;
    } catch (err) {
      console.warn('[FlipClock] 저장소를 쓸 수 없어 설정이 유지되지 않습니다:', err.message);
      return null;
    }
  })();

  var totalSeconds = T.loadSeconds(storage);
  var remaining = totalSeconds;   // 초
  var deadline = null;            // Date.now() 기준 ms. null 이면 정지 상태
  var lastDateText = '';
  var cards = [];
  var audioCtx = null;

  // ---------- 플립 카드 ----------

  function createCard() {
    var card = document.createElement('div');
    card.className = 'card';
    card.dataset.digit = '0';
    card.innerHTML =
      '<div class="half upper"><span>0</span></div>' +
      '<div class="half lower"><span>0</span></div>' +
      '<div class="flap flap-front"><span>0</span></div>' +
      '<div class="flap flap-back"><span>0</span></div>';

    var parts = {
      root: card,
      upper: card.querySelector('.upper span'),
      lower: card.querySelector('.lower span'),
      front: card.querySelector('.flap-front span'),
      back: card.querySelector('.flap-back span')
    };

    // 펼침 애니메이션이 끝나는 시점에 아래 반쪽을 새 숫자로 바꾼다.
    card.addEventListener('animationend', function (event) {
      if (event.animationName === 'flip-up') {
        finishFlip(parts);
      }
    });
    return parts;
  }

  function finishFlip(parts) {
    var digit = parts.root.dataset.digit;
    parts.lower.textContent = digit;
    parts.front.textContent = digit;   // 접힘 조각을 원위치시켜도 깜빡이지 않게 미리 맞춘다
    parts.root.classList.remove('flipping');
  }

  function setDigit(parts, digit) {
    if (parts.root.dataset.digit === digit) {
      return;
    }
    var prev = parts.root.dataset.digit;
    parts.root.dataset.digit = digit;

    parts.upper.textContent = digit;   // 위 반쪽은 즉시 교체 (조각이 내려가며 드러난다)
    parts.front.textContent = prev;    // 접혀 내려가는 조각 = 이전 숫자의 윗절반
    parts.back.textContent = digit;    // 펼쳐지는 조각 = 새 숫자의 아랫절반
    // 아래 반쪽은 애니메이션이 끝난 뒤 교체한다 (finishFlip)

    parts.root.classList.remove('flipping');
    void parts.root.offsetWidth;       // 리플로우를 강제해 애니메이션을 다시 시작시킨다
    parts.root.classList.add('flipping');
  }

  function buildClock() {
    for (var i = 0; i < CARD_COUNT; i++) {
      var parts = createCard();
      cards.push(parts);
      elClock.appendChild(parts.root);
      if (COLON_AFTER.indexOf(i) !== -1) {
        var colon = document.createElement('span');
        colon.className = 'colon';
        colon.textContent = ':';
        elClock.appendChild(colon);
      }
    }
  }

  // ---------- 타이머 ----------

  function updateTimerLabel() {
    // 남은 시간을 올림해 표시한다. 시작 직후 설정값이 그대로 보이고 0에서 끝난다.
    elTimer.textContent = T.formatDuration(Math.ceil(Math.max(0, remaining) - 1e-9));
  }

  function start() {
    stopFlash();
    unlockAudio();
    if (remaining <= 0) {
      remaining = totalSeconds;
    }
    deadline = Date.now() + remaining * 1000;
    btnStart.textContent = '⏸ 일시정지';
  }

  function pause() {
    remaining = Math.max(0, (deadline - Date.now()) / 1000);
    deadline = null;
    btnStart.textContent = '▶ 계속';
    updateTimerLabel();
  }

  function reset() {
    stopFlash();
    deadline = null;
    remaining = totalSeconds;
    btnStart.textContent = '▶ 시작';
    updateTimerLabel();
  }

  function finish() {
    deadline = null;
    remaining = 0;
    btnStart.textContent = '▶ 시작';
    updateTimerLabel();
    elTimer.classList.add('done');
    beep();
  }

  function stopFlash() {
    elTimer.classList.remove('done');
  }

  elTimer.addEventListener('animationend', stopFlash);

  // ---------- 갱신 루프 ----------

  function tick() {
    var now = new Date();
    var text = String(now.getHours()).padStart(2, '0') +
      String(now.getMinutes()).padStart(2, '0') +
      String(now.getSeconds()).padStart(2, '0');
    for (var i = 0; i < cards.length; i++) {
      setDigit(cards[i], text.charAt(i));
    }

    var dateText = now.getFullYear() + '-' +
      String(now.getMonth() + 1).padStart(2, '0') + '-' +
      String(now.getDate()).padStart(2, '0') +
      ' (' + WEEKDAYS[(now.getDay() + 6) % 7] + ')';
    if (dateText !== lastDateText) {
      lastDateText = dateText;
      elDate.textContent = dateText;
    }

    if (deadline !== null) {
      remaining = (deadline - Date.now()) / 1000;
      if (remaining <= 0) {
        finish();
      } else {
        updateTimerLabel();
      }
    }
  }

  // ---------- 알림음 ----------

  function audioContext() {
    var Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) {
      return null;
    }
    if (!audioCtx) {
      audioCtx = new Ctx();
    }
    return audioCtx;
  }

  /** 브라우저 자동재생 정책 때문에 클릭 시점에 오디오를 미리 깨워 둔다. */
  function unlockAudio() {
    try {
      var ctx = audioContext();
      if (ctx && ctx.state === 'suspended') {
        ctx.resume();
      }
    } catch (err) {
      console.warn('[FlipClock] 오디오를 준비하지 못했습니다:', err.message);
    }
  }

  /** 파이썬 버전의 winsound.Beep(880, 400) 과 같은 음·길이. */
  function beep() {
    try {
      var ctx = audioContext();
      if (!ctx) {
        console.warn('[FlipClock] 이 브라우저는 WebAudio 를 지원하지 않아 알림음을 낼 수 없습니다.');
        return;
      }
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 880;
      gain.gain.value = 0.15;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.4);
    } catch (err) {
      console.warn('[FlipClock] 알림음을 재생하지 못했습니다:', err.message);
    }
  }

  // ---------- 설정 창 ----------

  function openSettings() {
    var parts = T.splitDuration(totalSeconds);
    for (var i = 0; i < fields.length; i++) {
      fields[i].value = String(parts[i]);
    }
    elError.textContent = '';
    dialog.showModal();
    fields[0].focus();
  }

  form.addEventListener('submit', function (event) {
    var result = T.parseFields(fields.map(function (input) { return input.value; }));
    if (!result.ok) {
      event.preventDefault();          // 창을 닫지 않고 사유를 보여준다
      elError.textContent = result.message;
      return;
    }
    totalSeconds = result.seconds;
    T.saveSeconds(totalSeconds, storage);
    reset();                           // 실행 중이었다면 정지하고 새 값으로 되돌린다
  });

  btnCancel.addEventListener('click', function () {
    dialog.close();
  });

  // ---------- 시작 ----------

  btnStart.addEventListener('click', function () {
    if (deadline === null) {
      start();
    } else {
      pause();
    }
  });
  btnReset.addEventListener('click', reset);
  btnSettings.addEventListener('click', openSettings);

  buildClock();
  updateTimerLabel();
  tick();
  setInterval(tick, TICK_MS);
})();
