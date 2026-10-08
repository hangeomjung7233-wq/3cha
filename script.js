(function () {
  'use strict';

  /* =====================================================
     공통 상수
     ===================================================== */
  var KEY = 'ssukssuk.v1';
  var START = '2026-10-01';       // 주기 시작일
  var DEMO0 = '2026-10-07';       // 시연 시작 날짜
  var PATIENT = { name: '김순자', age: 72, meds: ['혈압약', '당뇨약'] }; // 시연용 대상자 정보
  var STAGES = ['seed', 'sprout', 'bud', 'flower'];
  var STAGE_NAME = { seed: '씨앗', sprout: '새싹', bud: '꽃봉오리', flower: '활짝 핀 꽃' };
  var STAGE_EMO = { seed: '🌰', sprout: '🌱', bud: '🌷', flower: '🌸' };
  var WD = ['일', '월', '화', '수', '목', '금', '토'];
  var FACES = ['😄', '😊', '🙂', '😐', '😕', '😟', '😣', '😖', '😫', '😭', '😱'];
  var FACE_TXT = [
    '증상이 없어요', '아주 조금 불편해요', '조금 불편해요', '약간 불편해요',
    '불편한 편이에요', '보통으로 불편해요', '꽤 불편해요', '많이 불편해요',
    '아주 많이 불편해요', '매우 심하게 불편해요', '견디기 힘들어요'
  ];

  /* =====================================================
     저장소 (localStorage 접근 불가여도 메모리로 정상 동작)
     ===================================================== */
  function fresh() {
    return { records: {}, demoDate: DEMO0, scores: [], guardian: [], medical: [], log: [] };
  }
  function load() {
    try {
      var s = window.localStorage.getItem(KEY);
      if (s) {
        var o = JSON.parse(s);
        if (o && o.records && o.demoDate) {
          o.scores = o.scores || []; o.guardian = o.guardian || [];
          o.medical = o.medical || []; o.log = o.log || [];
          return o;
        }
      }
    } catch (e) { /* 무시 */ }
    return fresh();
  }
  function save() {
    try { window.localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* 무시 */ }
  }

  var state = load();
  var view = { y: 2026, m: 10 };
  var cur = 'plant';
  var sel = null;
  var thanksTimer = null;
  var pendingDate = null;
  var adminOpen = { g: false, m: false };
  var justGrew = false;

  /* =====================================================
     날짜 도우미 (YYYY-MM-DD 문자열)
     ===================================================== */
  function $(id) { return document.getElementById(id); }
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function utc(s) { var p = s.split('-'); return Date.UTC(+p[0], +p[1] - 1, +p[2]); }
  function fmt(t) { var d = new Date(t); return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate()); }
  function addDays(s, n) { return fmt(utc(s) + n * 864e5); }
  function diff(a, b) { return Math.round((utc(b) - utc(a)) / 864e5); }
  function wd(s) { return new Date(utc(s)).getUTCDay(); }
  function md(s) { var p = s.split('-'); return (+p[1]) + '/' + (+p[2]); }
  function label(s) { var p = s.split('-'); return (+p[1]) + '월 ' + (+p[2]) + '일(' + WD[wd(s)] + ')'; }

  /* =====================================================
     공통 데이터 계산 (모든 값은 기록에서 계산)
     ===================================================== */
  function cycleOf(s) { return Math.floor(diff(START, s) / 7); }
  function cycleDays(c) {
    var a = [], i;
    for (i = 0; i < 7; i++) a.push(addDays(START, c * 7 + i));
    return a;
  }
  function doneIn(c) {
    return cycleDays(c).filter(function (d) { return state.records[d] === true; }).length;
  }
  function hasRec(c) {
    return cycleDays(c).some(function (d) { return d in state.records; });
  }
  // 'O' 완료 / 'X' 안 함 / '' 비움
  function dayStatus(d) {
    if (d < START) return '';
    if (d in state.records) return state.records[d] ? 'O' : 'X';
    if (d < state.demoDate) return 'X';
    return '';
  }
  function displayCycle() {
    var c = Math.max(0, cycleOf(state.demoDate));
    while (doneIn(c) === 7 && hasRec(c + 1)) c++;
    return c;
  }
  function stats(c) {
    var days = cycleDays(c), done = 0, missed = 0;
    days.forEach(function (d) {
      var s = dayStatus(d);
      if (s === 'O') done++;
      else if (s === 'X') missed++;
    });
    return { days: days, done: done, missed: missed, pct: Math.round(done / 7 * 100) };
  }
  function plantStage() {
    var seen = {}, n = 0;
    Object.keys(state.records).forEach(function (d) {
      var c = cycleOf(d);
      if (c >= 0 && !seen[c]) {
        seen[c] = 1;
        if (doneIn(c) === 7) n++;
      }
    });
    return STAGES[Math.min(3, n)];
  }

  /* =====================================================
     공통 화분 캐릭터 (모든 화면이 이 함수 하나로 그림)
     ===================================================== */
  function leafL(y) {
    return '<path d="M100 ' + (y + 4) + ' Q78 ' + (y - 16) + ' 66 ' + (y + 2) + ' Q82 ' + (y + 16) + ' 100 ' + (y + 4) +
      'Z" fill="#6fcf5a" stroke="#4aa83c" stroke-width="1.5" stroke-linejoin="round"/>';
  }
  function leafR(y) {
    return '<path d="M100 ' + (y + 4) + ' Q122 ' + (y - 16) + ' 134 ' + (y + 2) + ' Q118 ' + (y + 16) + ' 100 ' + (y + 4) +
      'Z" fill="#6fcf5a" stroke="#4aa83c" stroke-width="1.5" stroke-linejoin="round"/>';
  }
  function stem(top) {
    return '<path d="M100 120 L100 ' + top + '" stroke="#4aa83c" stroke-width="5" stroke-linecap="round" fill="none"/>';
  }

  function plantSVG(stage, size) {
    var top = '', soilExtra = '', i;

    if (stage === 'sprout') {
      top = stem(74) + leafL(72) + leafR(72);
    } else if (stage === 'bud') {
      top = stem(58) + leafL(90) + leafR(90) +
        '<ellipse cx="100" cy="44" rx="12" ry="17" fill="#f48fb1" stroke="#e0658f" stroke-width="1.5"/>' +
        '<ellipse cx="96" cy="40" rx="3" ry="7" fill="#fff" opacity=".35"/>' +
        '<path d="M90 58 Q100 70 110 58 Q100 52 90 58Z" fill="#5cb85c"/>';
    } else if (stage === 'flower') {
      top = stem(60) + leafL(92) + leafR(92);
      for (i = 0; i < 8; i++) {
        top += '<ellipse cx="100" cy="27" rx="9" ry="15" fill="#f7a1c4" stroke="#e0709f" stroke-width="1.2" transform="rotate(' + (i * 45) + ' 100 44)"/>';
      }
      top += '<circle cx="100" cy="44" r="11" fill="#ffd54a" stroke="#f2b705" stroke-width="1.5"/>';
    } else {
      soilExtra =
        '<ellipse cx="104" cy="124" rx="19" ry="11" fill="#3b261c"/>' +
        '<ellipse cx="104" cy="124" rx="6.5" ry="11" transform="rotate(40 104 124)" fill="#a9743e"/>' +
        '<ellipse cx="102" cy="119" rx="1.8" ry="4.5" transform="rotate(40 102 119)" fill="#f3d6a4"/>' +
        '<line x1="100" y1="111" x2="103" y2="117" stroke="#ffd23f" stroke-width="2.4" stroke-dasharray="2.5 3.5" stroke-linecap="round"/>';
    }

    var pot =
      '<path d="M48 146 L152 146 Q150 206 136 214 Q100 220 64 214 Q50 206 48 146Z" fill="#e9a98b" stroke="#d58f6e" stroke-width="2" stroke-linejoin="round"/>' +
      '<path d="M50 134 Q100 86 150 134Z" fill="#8a5f45"/>' + soilExtra +
      '<rect x="38" y="130" width="124" height="22" rx="11" fill="#f4c4aa" stroke="#d58f6e" stroke-width="2"/>' +
      '<rect x="46" y="133" width="108" height="5" rx="2.5" fill="#fff" opacity=".45"/>' +
      '<path d="M57 160 Q55 190 64 205" stroke="#fff" stroke-opacity=".5" stroke-width="6" stroke-linecap="round" fill="none"/>' +
      // 얼굴
      '<ellipse cx="82" cy="177" rx="7.5" ry="9.5" fill="#3a2a24"/><circle cx="84.5" cy="173" r="2.7" fill="#fff"/>' +
      '<ellipse cx="118" cy="177" rx="7.5" ry="9.5" fill="#3a2a24"/><circle cx="120.5" cy="173" r="2.7" fill="#fff"/>' +
      '<ellipse cx="68" cy="191" rx="8" ry="5" fill="#f48fa0" opacity=".65"/>' +
      '<ellipse cx="132" cy="191" rx="8" ry="5" fill="#f48fa0" opacity=".65"/>' +
      '<path d="M88 189 Q100 208 112 189Z" fill="#8a2f3d" stroke="#8a2f3d" stroke-width="2" stroke-linejoin="round"/>' +
      '<path d="M93.5 195 Q100 200.5 106.5 195 Q100 191.5 93.5 195Z" fill="#ff8fa3"/>';

    return '<svg class="plant" viewBox="0 0 200 230" width="' + size + '" height="' + Math.round(size * 1.15) +
      '" role="img" aria-label="화분 캐릭터 ' + STAGE_NAME[stage] + ' 단계">' + top + pot + '</svg>';
  }

  /* =====================================================
     탭 전환
     ===================================================== */
  function showTab(name) {
    cur = name;
    if (thanksTimer) { clearTimeout(thanksTimer); thanksTimer = null; }
    ['log', 'plant', 'body'].forEach(function (t) {
      $('tab-' + t).hidden = (t !== name);
    });
    var btns = document.querySelectorAll('.tabbar button');
    Array.prototype.forEach.call(btns, function (b) {
      var on = b.getAttribute('data-tab') === name;
      b.classList.toggle('on', on);
      if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
    if (name === 'body') resetBody();
    var s = $('tab-' + name);
    if (s) s.scrollTop = 0;
  }

  /* =====================================================
     ① 복약 기록
     ===================================================== */
  function bubbleText(st) {
    var any = st.days.some(function (d) { return d in state.records; });
    if (!any) return '오늘 약을 드셨나요?';
    if (st.done === 7) return '대단하세요! 이번 주 약을 모두 드셨어요';
    if (st.missed > 0) return '괜찮아요, 오늘부터 다시 챙겨 드세요';
    return '꾸준히 복약하고 계시네요!';
  }

  function renderLog() {
    var c = displayCycle(), st = stats(c), stage = plantStage();
    var remain = 7 - st.done;
    var tip;
    if (remain === 0) tip = '이번 주 7일을 모두 드셨어요';
    else if (stage === 'flower') tip = '활짝 핀 꽃을 유지하고 있어요 (이번 주 ' + remain + '일 남음)';
    else tip = '이번 주 ' + remain + '일 더 드시면 식물이 자라요';

    var h = '';
    h += '<button type="button" class="back" data-act="back" aria-label="뒤로가기"><span class="arr">←</span><span>뒤로</span></button>';
    h += '<h1>복약 기록</h1>';
    h += '<div class="top-row"><div class="plantbox">' + plantSVG(stage, 100) + '</div>' +
      '<div class="bubble">' + bubbleText(st) + '</div></div>';
    h += '<p class="tip">' + tip + ' · 현재 단계: ' + STAGE_NAME[stage] + ' ' + STAGE_EMO[stage] + '</p>';

    h += '<div class="monthbar">' +
      '<button type="button" class="circ" data-act="prev" aria-label="이전 달">‹</button>' +
      '<span class="title">' + view.y + '년 ' + view.m + '월</span>' +
      '<button type="button" class="circ" data-act="next" aria-label="다음 달">›</button></div>';

    h += '<div class="wk">' + WD.map(function (w) { return '<div>' + w + '</div>'; }).join('') + '</div>';

    var first = view.y + '-' + pad(view.m) + '-01';
    var lead = wd(first);
    var dim = new Date(Date.UTC(view.y, view.m, 0)).getUTCDate();
    var cells = '', i;
    for (i = 0; i < lead; i++) cells += '<div class="cell blank"></div>';
    for (i = 1; i <= dim; i++) {
      var d = view.y + '-' + pad(view.m) + '-' + pad(i);
      var s = dayStatus(d);
      var can = d >= START && !(d in state.records);
      var cls = 'cell' + (s === 'O' ? ' ok' : s === 'X' ? ' no' : '') +
        (d === state.demoDate ? ' today' : '') + (can ? ' tap' : '');
      var inner = '<b>' + i + '</b>' + (s ? '<span>복약 ' + s + '</span>' : '');
      cells += can
        ? '<button type="button" class="' + cls + '" data-date="' + d + '">' + inner + '</button>'
        : '<div class="' + cls + '">' + inner + '</div>';
    }
    h += '<div class="cal">' + cells + '</div>';
    h += '<p class="cal-hint">날짜를 누르면 약을 먹었는지 기록할 수 있어요.</p>';

    h += '<hr class="rule">';
    h += '<h2>이번 주기 복약 달성률</h2>';
    h += '<div class="prog">' +
      '<div class="prog-l"><div class="ring">' + plantSVG(stage, 46) + '</div>' +
      '<div class="barwrap"><div class="bar"><i style="width:' + st.pct + '%"></i></div><div class="pct">' + st.pct + '%</div></div></div>' +
      '<div class="prog-r"><div class="g"><small>복용완료</small><b>' + st.done + '일</b></div>' +
      '<div class="r"><small>미복용</small><b>' + st.missed + '일</b></div></div></div>';

    $('tab-log').innerHTML = h;
  }

  /* ---------- 팝업 ---------- */
  function openModal(html) { $('modalRoot').innerHTML = '<div class="overlay" role="dialog" aria-modal="true">' + html + '</div>'; }
  function closeModal() { $('modalRoot').innerHTML = ''; pendingDate = null; }

  function ask(d) {
    if (d < START || d in state.records) return;
    pendingDate = d;
    openModal('<div class="dialog"><h2>' + label(d) + ' 약을 드셨나요?</h2>' +
      '<button type="button" class="btn yes" data-act="yes">예, 먹었어요</button>' +
      '<button type="button" class="btn no" data-act="no">아니요, 안 먹었어요</button>' +
      '<button type="button" class="btn neutral" data-act="close">닫기</button></div>');
  }

  function record(d, val) {
    if (!d || d < START || d in state.records) { closeModal(); return; }
    var before = plantStage();
    state.records[d] = val;
    save();
    closeModal();
    var after = plantStage();
    var grew = STAGES.indexOf(after) > STAGES.indexOf(before);
    justGrew = grew;
    renderAll();
    if (grew) showGrowth(before, after);
    justGrew = false;
  }

  function showGrowth(from, to) {
    openModal('<div class="dialog"><h2>🎉 7일 복약 달성!<br>식물이 ' + STAGE_NAME[from] + '에서 ' + STAGE_NAME[to] + ' 단계로 자랐어요!</h2>' +
      '<div class="pw grow">' + plantSVG(to, 150) + '</div>' +
      '<button type="button" class="btn primary" data-act="ok">확인</button></div>');
  }

  /* =====================================================
     ② 내 식물 (홈)
     ===================================================== */
  function renderPlant() {
    var c = displayCycle(), st = stats(c), stage = plantStage();
    var first = st.days[0], last = st.days[6];

    var dots = st.days.map(function (d) {
      var s = dayStatus(d);
      var cl = 'dot' + (s === 'O' ? ' ok' : s === 'X' ? ' no' : '') + (d === state.demoDate ? ' now' : '');
      return '<div class="dwrap"><div class="' + cl + '">' + (s === 'O' ? '✓' : s === 'X' ? '×' : '') +
        '</div><div class="dd">' + md(d) + '</div></div>';
    }).join('');

    var next, warn = false;
    if (stage === 'flower') next = '활짝 핀 꽃을 유지하고 있어요. 7일 복약을 이어가 보세요!';
    else if (st.missed > 0) { next = '이번 주기는 아쉬워요. 다음 주기에 다시 도전해요!'; warn = true; }
    else if (st.done === 7) next = '이번 주기를 모두 채웠어요! 다음 주기에도 도전해요';
    else next = '다음 성장까지 ' + (7 - st.done) + '일 남았어요!';

    var h = '';
    h += '<h1 class="home-title">이번 주 복약 달성률</h1>';
    h += '<p class="home-sub">' + (c + 1) + '주차 · ' + md(first) + '~' + md(last) + ' (7일 단위로 한 달 진행)</p>';
    h += '<div class="big">' + st.done + '/7일</div>';
    h += '<div class="bigpct">' + st.pct + '%</div>';
    h += '<div class="bar homebar"><i style="width:' + st.pct + '%"></i></div>';
    h += '<div class="dots">' + dots + '</div>';
    h += '<button type="button" class="plant-btn' + (justGrew ? ' bump' : '') + '" data-act="goLog" aria-label="화분을 누르면 복약 기록으로 이동해요">' + plantSVG(stage, 240) + '</button>';
    h += '<div class="stage">현재 단계: ' + STAGE_NAME[stage] + ' ' + STAGE_EMO[stage] + '</div>';
    h += '<div class="next' + (warn ? ' warn' : '') + '">' + next + '</div>';

    $('tab-plant').innerHTML = h;
    $('tabPlantIcon').innerHTML = plantSVG(stage, 30);
  }

  /* =====================================================
     ③ 몸 상태
     ===================================================== */
  function buildScale() {
    var h = '', i;
    for (i = 0; i <= 10; i++) {
      h += '<button type="button" class="sc' + (sel === i ? ' on' : '') + '" style="--h:' + (120 - i * 12) +
        '" data-s="' + i + '" aria-label="' + i + '점"><span class="f">' + FACES[i] + '</span><span class="n">' + i + '</span></button>';
    }
    $('scale').innerHTML = h;
    $('chosen').innerHTML = sel === null
      ? '<span class="ph">얼굴을 선택해 주세요</span>'
      : '<span class="cf">' + FACES[sel] + '</span><span class="cs">' + sel + '점</span><span class="ct">' + FACE_TXT[sel] + '</span>';
    $('bodyDone').disabled = (sel === null);
  }
  function resetBody() {
    sel = null;
    $('bodyForm').hidden = false;
    $('bodyThanks').hidden = true;
    buildScale();
  }
  function addLog(msg) { state.log.push('[' + md(state.demoDate) + '] ' + msg); if (state.log.length > 50) state.log.shift(); }

  function submitBody() {
    if (sel === null) return;
    var d = state.demoDate, score = sel;
    state.scores.push({ date: d, score: score });
    if (score >= 5) {
      state.guardian.push({ date: d, score: score });
      addLog('보호자 알림 · ' + PATIENT.name + '님 ' + score + '점');
      var n = state.scores.filter(function (x) { return x.date === d && x.score >= 5; }).length;
      if (n === 3) {
        state.medical.push({ date: d });
        addLog('의료진 연계 · 하루 5점 이상 3회 누적');
      }
    }
    save();
    $('bodyForm').hidden = true;
    $('bodyThanks').hidden = false;
    renderAdmin();
    thanksTimer = setTimeout(function () { thanksTimer = null; showTab('plant'); }, 2200);
  }

  /* =====================================================
     시연용 관리자 패널
     ===================================================== */
  function renderAdmin() {
    var today = state.demoDate;
    var cnt = state.scores.filter(function (x) { return x.date === today && x.score >= 5; }).length;
    var linkedToday = state.medical.some(function (m) { return m.date === today; });

    var grid = '', i, lead = wd('2026-10-01');
    for (i = 0; i < lead; i++) grid += '<div class="ag blank"></div>';
    for (i = 1; i <= 31; i++) {
      var d = '2026-10-' + pad(i);
      var v = d in state.records ? (state.records[d] ? 'O' : 'X') : '';
      grid += '<div class="ag' + (v === 'O' ? ' ok' : v === 'X' ? ' no' : '') + '">' + i + '<br>' + (v || '&nbsp;') + '</div>';
    }

    var gHtml = state.guardian.length
      ? state.guardian.map(function (g) {
          return '<p>' + PATIENT.name + '님의 부작용이 5점 이상(' + g.score + '점)으로 기록되었어요.(' + label(g.date) + ')</p>';
        }).join('')
      : '<p class="muted">아직 보호자 알림이 없어요.</p>';

    var mHtml = state.medical.length
      ? '<p><b>5점 이상 누적 3회 이상으로 알람이 왔어요.</b></p>' +
        '<p>이름: ' + PATIENT.name + ' · 나이: ' + PATIENT.age + '세</p>' +
        '<p>복용약: ' + PATIENT.meds.join(', ') + '</p>' +
        '<p>점수 이력: ' + state.scores.map(function (x) { return md(x.date) + ' ' + x.score + '점'; }).join(' / ') + '</p>'
      : '<p class="muted">아직 의료진 연계가 없어요.</p>';

    var logs = state.log.length
      ? '<ul class="logs">' + state.log.slice().reverse().slice(0, 10).map(function (l) { return '<li>' + l + '</li>'; }).join('') + '</ul>'
      : '<p class="muted">기록이 없어요.</p>';

    $('admin').innerHTML =
      '<h3>시연용 관리자 패널 <span class="muted">(대상자 화면에는 나오지 않아요)</span></h3>' +
      '<p><b>시연 날짜: ' + view0(today) + '</b></p>' +
      '<div class="row"><button type="button" data-act="plus">시연 날짜 +1일</button>' +
      '<button type="button" data-act="reset">처음 상태로 초기화</button></div>' +
      '<h4>10월 복약 기록 현황 (보기 전용)</h4>' +
      '<div class="agrid">' + WD.map(function (w) { return '<div class="ag" style="border:0;background:none;min-height:0">' + w + '</div>'; }).join('') + grid + '</div>' +
      '<h4>부작용 알림 현황</h4>' +
      '<ul class="stats"><li>오늘 5점 이상 횟수: ' + cnt + '회</li>' +
      '<li>오늘 의료진 연계: ' + (linkedToday ? '연계됨' : '아직 아님') + '</li>' +
      '<li>보호자 알림: ' + state.guardian.length + '건</li>' +
      '<li>의료진 연계: ' + state.medical.length + '건</li></ul>' +
      '<div class="row"><button type="button" data-act="tg" class="' + (adminOpen.g ? 'on' : '') + '">보호자 화면</button>' +
      '<button type="button" data-act="tm" class="' + (adminOpen.m ? 'on' : '') + '">의료진 화면</button></div>' +
      (adminOpen.g ? '<div class="panel"><h4>보호자 화면</h4>' + gHtml + '</div>' : '') +
      (adminOpen.m ? '<div class="panel"><h4>의료진 화면</h4>' + mHtml + '</div>' : '') +
      '<h4>알림·연계 로그</h4>' + logs;
  }
  function view0(s) { var p = s.split('-'); return p[0] + '년 ' + label(s); }

  /* =====================================================
     전체 다시 그리기
     ===================================================== */
  function renderAll() {
    renderLog();
    renderPlant();
    renderAdmin();
  }

  /* =====================================================
     이벤트
     ===================================================== */
  function moveMonth(n) {
    view.m += n;
    if (view.m < 1) { view.m = 12; view.y--; }
    if (view.m > 12) { view.m = 1; view.y++; }
    renderLog();
  }

  $('tab-log').addEventListener('click', function (e) {
    var t = e.target.closest('[data-date],[data-act]');
    if (!t) return;
    if (t.getAttribute('data-date')) { ask(t.getAttribute('data-date')); return; }
    var a = t.getAttribute('data-act');
    if (a === 'back') showTab('plant');
    else if (a === 'prev') moveMonth(-1);
    else if (a === 'next') moveMonth(1);
  });

  $('tab-plant').addEventListener('click', function (e) {
    if (e.target.closest('[data-act="goLog"]')) showTab('log');
  });

  $('modalRoot').addEventListener('click', function (e) {
    var t = e.target.closest('[data-act]');
    if (!t) return;
    var a = t.getAttribute('data-act');
    if (a === 'yes') record(pendingDate, true);
    else if (a === 'no') record(pendingDate, false);
    else closeModal(); // close, ok
  });

  document.querySelector('.tabbar').addEventListener('click', function (e) {
    var b = e.target.closest('button[data-tab]');
    if (b) showTab(b.getAttribute('data-tab'));
  });

  $('scale').addEventListener('click', function (e) {
    var b = e.target.closest('[data-s]');
    if (!b) return;
    sel = +b.getAttribute('data-s');
    buildScale();
  });
  $('bodyDone').addEventListener('click', submitBody);

  $('admin').addEventListener('click', function (e) {
    var t = e.target.closest('[data-act]');
    if (!t) return;
    var a = t.getAttribute('data-act');
    if (a === 'plus') {
      state.demoDate = addDays(state.demoDate, 1);
      var p = state.demoDate.split('-');
      view.y = +p[0]; view.m = +p[1];
      save(); renderAll();
    } else if (a === 'reset') {
      state = fresh();
      view = { y: 2026, m: 10 };
      adminOpen = { g: false, m: false };
      closeModal(); save(); renderAll(); showTab('plant');
    } else if (a === 'tg') { adminOpen.g = !adminOpen.g; renderAdmin(); }
    else if (a === 'tm') { adminOpen.m = !adminOpen.m; renderAdmin(); }
  });

  /* =====================================================
     시작: 항상 ② 내 식물 탭이 홈
     ===================================================== */
  (function init() {
    var p = state.demoDate.split('-');
    view.y = +p[0]; view.m = +p[1];
    renderAll();
    showTab('plant');
  })();
})();
