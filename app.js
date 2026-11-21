/* 잃어버린 것, 주운 것 — 축제 분실물 후보 찾기 (예시 서비스)
   - 검색은 이 브라우저 안에서만 돕니다. 외부 호출이 없습니다.
   - 방법: 묘사와 대장 문장을 낱말로 나눠 두 글자씩 자르고(글자 2-gram), TF-IDF 코사인 유사도로 순서를 정합니다.
   - 화면에는 점수를 보여 주지 않고 '겹치는 말'을 근거로 보여 줍니다. 정하는 일은 사람이 단추로 합니다. */
(function (global) {
  'use strict';

  /* ───────────── 1. 낱말 다루기 ───────────── */

  // 색을 나타내는 말. 대표말: [같은 말...]  (색만 겹치는 습득물은 후보로 올리지 않습니다)
  var COLORS = {
    '검은': ['검은색', '검정색', '검정', '까만색', '까만', '까망', '블랙'],
    '흰': ['흰색', '하얀색', '하얀', '하양', '화이트'],
    '빨간': ['빨간색', '빨강색', '빨강', '붉은색', '붉은', '레드'],
    '파란': ['파란색', '파랑색', '파랑', '푸른색', '푸른', '블루'],
    '노란': ['노란색', '노랑색', '노랑', '옐로'],
    '초록': ['초록색', '녹색', '그린'],
    '분홍': ['분홍색', '핑크색', '핑크'],
    '보라': ['보라색', '퍼플'],
    '회색': ['쥐색', '그레이'],
    '갈색': ['밤색', '브라운'],
    '남색': ['네이비색', '네이비', '곤색'],
    '은색': ['실버'],
    '금색': ['골드'],
    '하늘색': []
  };

  // 같은 뜻으로 보는 말 (운영진이 직접 만든 표). 낱말 하나 → 대표 낱말들
  var WORDS = {
    '휴대폰': ['휴대전화'], '핸드폰': ['휴대전화'], '스마트폰': ['휴대전화'], '전화기': ['휴대전화'], '폰': ['휴대전화'],
    '차키': ['자동차', '열쇠'], '자동차키': ['자동차', '열쇠'], '스마트키': ['자동차', '열쇠'], '키': ['열쇠'],
    '배낭': ['백팩'], '천가방': ['에코백'], '긴지갑': ['장지갑'],
    '보온병': ['텀블러'], '물통': ['물병'],
    '아이': ['어린이'], '애': ['어린이'], '아동': ['어린이'],
    '액정': ['화면'], '케이블': ['충전선'],
    '점퍼': ['겉옷'], '잠바': ['겉옷'], '재킷': ['겉옷'], '자켓': ['겉옷'],
    '뱃지': ['배지'], '명찰': ['이름표'],
    '땡땡이': ['물방울무늬'], '도트': ['물방울무늬'],
    '접는': ['접이식'],
    '금테': ['금색', '테'], '은테': ['은색', '테'],
    '곰인형': ['곰', '인형']
  };

  // 두 낱말이 이어질 때 같은 뜻으로 보는 말
  var PHRASES = [
    [['자동차', '키'], ['자동차', '열쇠']],
    [['차', '키'], ['자동차', '열쇠']],
    [['차', '열쇠'], ['자동차', '열쇠']],
    [['긴', '지갑'], ['장지갑']],
    [['천', '가방'], ['에코백']],
    [['안경', '케이스'], ['안경집']]
  ];

  // 한 글자 낱말은 뜻이 흐려지기 쉬워 아래 것만 씁니다
  var ONE_CHAR_OK = { '흰': 1, '곰': 1, '별': 1, '줄': 1, '끈': 1, '옷': 1, '테': 1, '챙': 1 };

  // 물건을 가리키지 않는 군말 (통째로 같을 때 뺌)
  var STOP_EXACT = ('것 거 건 게 데 때 쪽 개 좀 제 저 그 이 든 한 안 속 겉 위 앞 뒤 옆 밑 몇 장 ' +
    '하나 한개 정도 근처 여기 거기 저기 이거 그거 저거 뭐 어떤 무슨 그리고 그런데 근데 그래서 그냥 아마 혹시 ' +
    '약간 조금 많이 아주 너무 진짜 정말 거의 어제 오늘 아까 방금 지금 제가 저는 저희 우리 있음 없음 있는 없는 있어요 없어요').split(' ');
  // 물건을 가리키지 않는 군말 (이렇게 시작하면 뺌)
  var STOP_PREFIX = /^(잃어버|분실|찾아|찾고|찾습|찾는|있어|있습|있던|있었|있고|없어|없습|없던|없었|같아|같은|같습|달려|달린|달렸|달리|달림|붙어|붙은|붙여|붙였|들어|넣어|넣은|넣고|놓고|놓은|놨|뒀|두고|했|하는|하고|해서|해요|됐|되는|되어|쓰던|쓰는|썼|들고|다니|가지고|갖고|거예|거에|거요|거였|것이|건데|모르|기억|생각)/;
  // 지난 일을 말하는 말끝 (낱말 전체를 뺌)
  var VERB_END = /(었어요|았어요|였어요|했어요|됐어요|렸어요|졌어요|웠어요|겼어요|놨어요|뒀어요|봤어요|왔어요|갔어요|었습니다|았습니다|였습니다|했습니다|었는데|았는데|였는데|했는데|더라고요|거든요)$/;
  // 낱말 끝에 붙는 조사·말끝 (긴 것부터)
  var PARTICLES = ['이었습니다', '이거든요', '이라고요', '입니다만', '이었어요', '이에요', '이예요', '이고요', '이구요', '입니다', '이라서', '이지만', '인데요', '에서는', '에서도', '으로는', '이라고',
    '예요', '에요', '라서', '지만', '인데', '이고', '이며', '이랑', '에서', '에게', '한테', '으로', '라고', '이요', '이나', '까지', '부터', '처럼', '보다', '마다', '하고',
    '랑', '은', '는', '이', '가', '을', '를', '에', '의', '와', '과', '도', '로', '만', '요'];

  var COLOR_OF = {};      // 색을 나타내는 모든 말 → 대표말
  var COLOR_FORMS = [];   // 긴 것부터 (붙여 쓴 말을 가를 때 씀)
  Object.keys(COLORS).forEach(function (c) {
    COLOR_OF[c] = c;
    COLORS[c].forEach(function (v) { COLOR_OF[v] = c; });
  });
  COLOR_FORMS = Object.keys(COLOR_OF).sort(function (a, b) { return b.length - a.length; });

  function isColor(tok) { return Object.prototype.hasOwnProperty.call(COLORS, tok); }
  function has(obj, k) { return Object.prototype.hasOwnProperty.call(obj, k); }

  function splitWords(text) {
    return String(text).toLowerCase().split(/[^0-9a-z가-힣]+/).filter(function (w) { return w.length > 0; });
  }
  function isStop(w) {
    return STOP_EXACT.indexOf(w) >= 0 || STOP_PREFIX.test(w);
  }

  // 낱말 하나를 대표 낱말들로 바꿉니다. (색 말, 같은말 표, 색이 앞에 붙은 말)
  function canon(w) {
    if (has(COLOR_OF, w)) return [COLOR_OF[w]];
    if (has(WORDS, w)) return WORDS[w].slice();
    for (var i = 0; i < COLOR_FORMS.length; i++) {
      var f = COLOR_FORMS[i];
      if (w.length - f.length >= 2 && w.indexOf(f) === 0) {
        return [COLOR_OF[f]].concat(canon(w.slice(f.length)));
      }
    }
    return [w];
  }

  /* ───────────── 2. 습득물 대장 색인 ───────────── */

  var ITEMS = [];          // {raw, id, descToks, placeToks, vec, norm}
  var KNOWN = {};          // 대장에 나오는 낱말 + 같은말 표의 낱말
  var KNOWN_LIST = [];
  var IDF = {};

  function applyPhrases(stems) {
    var out = [];
    for (var i = 0; i < stems.length; i++) {
      var done = false;
      for (var p = 0; p < PHRASES.length && !done; p++) {
        var from = PHRASES[p][0];
        if (i + 1 < stems.length && stems[i].w === from[0] && stems[i + 1].w === from[1]) {
          var src = stems[i].w + ' ' + stems[i + 1].w;
          PHRASES[p][1].forEach(function (t) { out.push({ t: t, from: src }); });
          i++; done = true;
        }
      }
      if (!done) {
        canon(stems[i].w).forEach(function (t) { out.push({ t: t, from: stems[i].w }); });
      }
    }
    return out.filter(function (x) { return x.t.length >= 2 || has(ONE_CHAR_OK, x.t); });
  }

  // 대장 문장 → 낱말 (대장은 조사를 빼고 메모하듯 적으므로 조사를 떼지 않습니다)
  function ledgerTokens(text) {
    var stems = splitWords(text).filter(function (w) { return !isStop(w); }).map(function (w) { return { w: w }; });
    return applyPhrases(stems).map(function (x) { return x.t; });
  }

  function knownStem(s) {
    if (has(KNOWN, s)) return true;
    if (s.length < 2) return false;
    for (var i = 0; i < KNOWN_LIST.length; i++) if (KNOWN_LIST[i].indexOf(s) >= 0) return true;
    return false;
  }

  // 묘사의 낱말 하나에서 조사를 뗍니다. 대장에 있는 말이 되도록 떼는 것을 먼저 해 봅니다.
  function stemOf(w) {
    if (isStop(w)) return null;
    if (has(KNOWN, w)) return w;
    var i, p, s;
    for (i = 0; i < PARTICLES.length; i++) {
      p = PARTICLES[i];
      if (w.length > p.length && w.slice(-p.length) === p) {
        s = w.slice(0, -p.length);
        if (isStop(s)) return null;
        if (knownStem(s)) return s;
      }
    }
    if (knownStem(w)) return w;
    if (VERB_END.test(w)) return null;
    for (i = 0; i < PARTICLES.length; i++) {
      p = PARTICLES[i];
      if (p.length >= 2 && w.length - p.length >= 2 && w.slice(-p.length) === p) return w.slice(0, -p.length);
    }
    return w;
  }

  // 묘사 → 찾는 데 쓸 낱말 [{t: 대표 낱말, from: 묘사에 적힌 말}]
  function queryTokens(text) {
    var stems = [];
    splitWords(text).forEach(function (w) {
      var s = stemOf(w);
      if (s) stems.push({ w: s });
    });
    var seen = {};
    return applyPhrases(stems).filter(function (x) {
      if (seen[x.t]) return false;
      seen[x.t] = 1; return true;
    });
  }

  function grams(tok) {
    if (tok.length === 1) return ['#' + tok];
    var g = [];
    for (var i = 0; i < tok.length - 1; i++) g.push(tok.substr(i, 2));
    return g;
  }
  function tfOf(toks) {
    var tf = {};
    toks.forEach(function (t) { grams(t).forEach(function (g) { tf[g] = (tf[g] || 0) + 1; }); });
    return tf;
  }
  function weigh(tf) {
    var vec = {}, sum = 0;
    Object.keys(tf).forEach(function (g) {
      if (!has(IDF, g)) return;            // 대장에 한 번도 안 나온 글자 조각은 세지 않습니다
      var w = tf[g] * IDF[g];
      vec[g] = w; sum += w * w;
    });
    return { vec: vec, norm: Math.sqrt(sum) };
  }
  function cosine(a, b) {
    if (!a.norm || !b.norm) return 0;
    var dot = 0;
    Object.keys(a.vec).forEach(function (g) { if (has(b.vec, g)) dot += a.vec[g] * b.vec[g]; });
    return dot / (a.norm * b.norm);
  }

  function buildIndex(rows) {
    ITEMS = []; KNOWN = {}; IDF = {};
    var df = {};
    (rows || []).forEach(function (raw) {
      var descToks = ledgerTokens((raw['종류'] || '') + ' ' + (raw['묘사'] || ''));
      var placeToks = ledgerTokens(raw['습득장소'] || '');
      var tf = tfOf(descToks.concat(placeToks));
      Object.keys(tf).forEach(function (g) { df[g] = (df[g] || 0) + 1; });
      descToks.concat(placeToks).forEach(function (t) { KNOWN[t] = 1; });
      ITEMS.push({ raw: raw, id: raw['번호'], descToks: descToks, placeToks: placeToks, tf: tf });
    });
    var n = ITEMS.length;
    Object.keys(df).forEach(function (g) { IDF[g] = Math.log((n + 1) / (df[g] + 1)) + 1; });
    ITEMS.forEach(function (it) { var w = weigh(it.tf); it.vec = w.vec; it.norm = w.norm; });
    KNOWN_LIST = Object.keys(KNOWN);
    Object.keys(COLOR_OF).forEach(function (k) { KNOWN[k] = 1; });
    Object.keys(WORDS).forEach(function (k) { KNOWN[k] = 1; });
    PHRASES.forEach(function (p) { p[0].forEach(function (k) { KNOWN[k] = 1; }); });
  }

  // 묘사의 낱말과 대장 낱말이 함께 가진 가장 긴 글자 토막 (두 글자 이상). 한 글자 낱말은 통째로 같을 때만.
  function sharedPiece(q, toks) {
    if (q.length === 1) return toks.indexOf(q) >= 0 ? q : null;
    var best = null;
    for (var k = 0; k < toks.length; k++) {
      var t = toks[k];
      if (t.length < 2) continue;
      for (var i = 0; i < q.length - 1; i++) {
        for (var len = q.length - i; len >= 2; len--) {
          if (best && len <= best.length) break;
          var sub = q.substr(i, len);
          if (t.indexOf(sub) >= 0) { best = sub; break; }
        }
      }
    }
    return best;
  }

  /* ───────────── 3. 찾기 ─────────────
     결과 state: blank(빈 입력) / need-more(쓸 말이 없거나 색·장소뿐) / not-found(후보 없음)
                 / ambiguous(겹치는 말이 똑같은 후보가 여럿) / candidates(후보 있음) */
  function search(input) {
    var text = String(input == null ? '' : input);
    var res = { state: 'blank', query: text, tokens: [], notInLedger: [], candidates: [], tieCount: 0, total: ITEMS.length };
    if (!text.replace(/\s/g, '')) return res;

    var toks = queryTokens(text);
    res.tokens = toks;
    if (!toks.length) { res.state = 'need-more'; res.reason = 'no-words'; return res; }

    var anywhere = {};   // 낱말 → 대장 어디든 겹침이 있었는가
    var strongAnywhere = false;
    var cands = [];
    var qv = weigh(tfOf(toks.map(function (x) { return x.t; })));

    ITEMS.forEach(function (it) {
      var pieces = [], missing = [], strong = 0;
      toks.forEach(function (x) {
        var p = sharedPiece(x.t, it.descToks);
        if (p) {
          var weak = isColor(p);
          pieces.push({ piece: p, type: weak ? 'color' : 'desc' });
          if (!weak) strong++;
          anywhere[x.t] = 1;
          return;
        }
        p = sharedPiece(x.t, it.placeToks);
        if (p) { pieces.push({ piece: p, type: 'place' }); anywhere[x.t] = 1; return; }
        missing.push(x.from);
      });
      if (strong > 0) {
        strongAnywhere = true;
        cands.push({ item: it.raw, id: it.id, pieces: pieces, missing: missing, sim: cosine(qv, it) });
      }
    });

    res.notInLedger = toks.filter(function (x) { return !anywhere[x.t]; }).map(function (x) { return x.from; });

    if (!strongAnywhere) {
      // 겹친 말이 모두 색이나 장소뿐이면 더 물어보게 하고, 하나도 안 겹치면 '후보 없음'
      var onlyWeak = toks.every(function (x) { return anywhere[x.t]; });
      if (onlyWeak) { res.state = 'need-more'; res.reason = 'weak-only'; }
      else { res.state = 'not-found'; }
      return res;
    }

    cands.sort(function (a, b) { return (b.sim - a.sim) || (a.id < b.id ? -1 : 1); });
    function key(c) { return c.pieces.map(function (p) { return p.piece; }).sort().join('|'); }
    var k0 = key(cands[0]);
    var tie = cands.filter(function (c) { return key(c) === k0; });
    var rest = cands.filter(function (c) { return key(c) !== k0; });
    res.tieCount = tie.length;
    if (tie.length >= 2) { res.state = 'ambiguous'; res.candidates = tie.concat(rest); }
    else { res.state = 'candidates'; res.candidates = cands; }
    return res;
  }

  buildIndex(global.FOUND_ITEMS);
  global.LostFound = { search: search, queryTokens: queryTokens, items: function () { return ITEMS.map(function (i) { return i.raw; }); } };

  /* ───────────── 4. 화면 ───────────── */

  if (!global.document) return;
  var doc = global.document;
  var FIRST_SHOWN = 3;   // 먼저 보여 주는 후보 수

  function el(tag, cls, text) {
    var e = doc.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function add(parent) {
    for (var i = 1; i < arguments.length; i++) if (arguments[i]) parent.appendChild(arguments[i]);
    return parent;
  }
  function srcTag(text) { return el('span', 'src', '출처: ' + text); }
  function chip(text, cls) { return el('span', 'chip' + (cls ? ' ' + cls : ''), text); }

  var $input = doc.getElementById('desc');
  var $results = doc.getElementById('results');
  var $form = doc.getElementById('search-form');

  function notice(kind, title, lines) {
    var box = el('div', 'notice notice-' + kind);
    box.setAttribute('data-state', kind);
    add(box, el('h2', 'notice-title', title));
    (lines || []).forEach(function (t) { if (t) add(box, typeof t === 'string' ? el('p', null, t) : t); });
    return box;
  }

  function echoBlock(res) {
    var box = el('div', 'card echo');
    var p = el('p', 'echo-row');
    add(p, el('span', 'label', '입력한 묘사 (그대로)'), el('q', 'echo-text', res.query), srcTag('방금 입력한 내용'));
    add(box, p);
    if (res.tokens.length) {
      var t = el('p', 'echo-row');
      add(t, el('span', 'label', '찾는 데 쓴 말'));
      res.tokens.forEach(function (x) {
        add(t, chip(x.from === x.t ? x.t : x.from + ' = ' + x.t, isColor(x.t) ? 'chip-weak' : ''));
      });
      add(t, el('span', 'hint', '조사와 군말은 뺐습니다. 새로 덧붙인 말은 없습니다.'));
      add(box, t);
    }
    if (res.notInLedger.length) {
      var m = el('p', 'echo-row');
      add(m, el('span', 'label', '대장에 없는 말'));
      res.notInLedger.forEach(function (w) { add(m, chip(w, 'chip-miss')); });
      add(box, m);
    }
    return box;
  }

  function askMore() {
    var box = el('div', 'ask');
    add(box, el('p', 'ask-title', '신고자에게 더 물어볼 것'));
    var ul = el('ul');
    ['물건의 종류', '색과 크기', '달린 것이나 무늬', '안에 든 것', '잃어버린 곳과 때'].forEach(function (t) { add(ul, el('li', null, t)); });
    add(box, ul, el('p', 'hint', '대장에 적힌 특징을 먼저 알려 주지 말고, 신고자가 스스로 말하게 해 주세요.'));
    return box;
  }

  function markedDesc(text, pieces) {
    var p = el('p', 'desc');
    var ranges = [];
    pieces.slice().sort(function (a, b) { return b.piece.length - a.piece.length; }).forEach(function (pc) {
      var from = 0, at;
      while ((at = text.indexOf(pc.piece, from)) >= 0) {
        var end = at + pc.piece.length;
        var clash = ranges.some(function (r) { return at < r[1] && end > r[0]; });
        if (!clash) ranges.push([at, end]);
        from = end;
      }
    });
    ranges.sort(function (a, b) { return a[0] - b[0]; });
    var pos = 0;
    ranges.forEach(function (r) {
      if (r[0] > pos) add(p, doc.createTextNode(text.slice(pos, r[0])));
      add(p, el('mark', null, text.slice(r[0], r[1])));
      pos = r[1];
    });
    if (pos < text.length) add(p, doc.createTextNode(text.slice(pos)));
    return p;
  }

  function field(name, value, id) {
    var row = el('div', 'field');
    add(row, el('dt', null, name));
    var dd = el('dd');
    if (value) add(dd, el('span', 'val', value), srcTag('대장 ' + id));
    else add(dd, el('span', 'need-check', '확인 필요'), el('span', 'hint', '대장에 적혀 있지 않습니다'));
    add(row, dd);
    return row;
  }

  function verifyPanel(c, card) {
    var box = el('div', 'verify');
    box.setAttribute('data-verified', 'no');
    var status = el('p', 'status status-before', '본인 확인 전입니다. 아직 물건을 내주지 않습니다.');
    add(box, status, el('p', null, '찾으러 온 사람 앞에서 담당자가 아래 세 가지를 직접 확인해 주세요. 이 화면에는 이름과 연락처를 적지 않습니다.'));
    var checks = [
      '신분증으로 찾으러 온 사람이 누구인지 확인했습니다.',
      '대장에 적힌 특징을 먼저 알려 주지 않았고, 찾으러 온 사람이 스스로 말한 특징이 대장과 맞았습니다.',
      '잃어버린 곳과 때가 습득 기록과 어긋나지 않았습니다.'
    ];
    var boxes = [];
    var confirm = el('button', 'btn btn-primary confirm', '담당자 확인: 본인 확인을 마쳤습니다');
    confirm.type = 'button'; confirm.disabled = true;
    checks.forEach(function (t) {
      var lab = el('label', 'check');
      var cb = doc.createElement('input'); cb.type = 'checkbox';
      cb.addEventListener('change', function () {
        confirm.disabled = !boxes.every(function (b) { return b.checked; });
      });
      boxes.push(cb);
      add(lab, cb, el('span', null, t));
      add(box, lab);
    });
    var notThis = el('button', 'btn btn-quiet not-this', '이 후보가 아닙니다');
    notThis.type = 'button';
    var after = el('div', 'after');
    add(box, add(el('div', 'btn-row'), confirm, notThis), after);

    confirm.addEventListener('click', function () {
      box.setAttribute('data-verified', 'yes');
      status.className = 'status status-after';
      status.textContent = '본인 확인 완료 — 담당자가 확인 단추를 눌렀습니다.';
      boxes.forEach(function (b) { b.disabled = true; });
      confirm.disabled = true; notThis.disabled = true;
      var rec = el('button', 'btn btn-primary record', '인계 기록 남기기 (모의)');
      rec.type = 'button';
      add(after, el('p', 'handover', '이제 보관 위치에서 물건을 꺼내 내줄 수 있습니다. 수령 확인을 받고 인계 기록을 남겨 주세요.'), rec);
      rec.addEventListener('click', function () {
        rec.disabled = true;
        add(after, el('p', 'mock', '모의 기록입니다. 대장 ' + c.id + '의 인계 내용은 실제 대장이나 외부 시스템에 저장·전송되지 않습니다.'));
      });
    });
    notThis.addEventListener('click', function () {
      box.parentNode.removeChild(box);
      card.classList.add('rejected');
      var b = card.querySelector('.start-verify');
      if (b) { b.disabled = true; b.textContent = '담당자가 아니라고 표시했습니다'; }
    });
    return box;
  }

  function candCard(c, no) {
    var card = el('article', 'card cand');
    card.setAttribute('data-id', c.id);
    var head = el('header', 'cand-head');
    add(head, el('span', 'cand-no', '후보 ' + no), el('span', 'cand-id', '대장 ' + c.id), el('span', 'kind', c.item['종류'] || '확인 필요'));
    add(card, head);

    var d = el('div', 'desc-wrap');
    add(d, el('span', 'label', '대장에 적힌 묘사'), markedDesc(c.item['묘사'] || '', c.pieces), srcTag('대장 ' + c.id));
    add(card, d);

    var ev = el('p', 'evi');
    add(ev, el('span', 'label', '근거 · 겹치는 말 ' + c.pieces.length + '개'));
    c.pieces.forEach(function (p) {
      add(ev, chip(p.piece + (p.type === 'color' ? ' (색)' : p.type === 'place' ? ' (장소)' : ''), p.type === 'desc' ? 'chip-hit' : 'chip-weak'));
    });
    add(card, ev);

    var ms = el('p', 'miss');
    add(ms, el('span', 'label', '묘사에는 있으나 이 기록에는 없는 말'));
    if (c.missing.length) c.missing.forEach(function (w) { add(ms, chip(w, 'chip-miss')); });
    else add(ms, el('span', 'hint', '없음'));
    add(card, ms);

    var dl = el('dl', 'fields');
    add(dl, field('습득 장소', c.item['습득장소'], c.id), field('습득 시각', c.item['습득시각'], c.id), field('보관 위치', c.item['보관위치'], c.id));
    add(card, dl);

    var start = el('button', 'btn btn-line start-verify', '이 후보로 본인 확인 시작');
    start.type = 'button';
    start.addEventListener('click', function () {
      var open = $results.querySelectorAll('.verify');
      for (var i = 0; i < open.length; i++) if (open[i].getAttribute('data-verified') === 'no') {
        var oc = open[i].parentNode; oc.removeChild(open[i]);
        var ob = oc.querySelector('.start-verify'); if (ob) ob.disabled = false;
      }
      start.disabled = true;
      add(card, verifyPanel(c, card));
    });
    add(card, start);
    return card;
  }

  function candList(cands, firstCount) {
    var wrap = el('div', 'cand-list');
    var rest = [];
    cands.forEach(function (c, i) {
      var card = candCard(c, i + 1);
      if (i >= firstCount) { card.hidden = true; rest.push(card); }
      add(wrap, card);
    });
    if (rest.length) {
      var more = el('button', 'btn btn-quiet more', '나머지 후보 ' + rest.length + '건 더 보기');
      more.type = 'button';
      more.addEventListener('click', function () {
        rest.forEach(function (c) { c.hidden = false; });
        more.parentNode.removeChild(more);
      });
      add(wrap, more);
    }
    return wrap;
  }

  function caution() {
    return el('p', 'caution', '후보일 뿐입니다. 같은 물건이라고 단정하지 않습니다. 본인 확인 전에는 물건을 내주지 않습니다.');
  }

  function render(res) {
    while ($results.firstChild) $results.removeChild($results.firstChild);
    $results.setAttribute('data-state', res.state);

    if (res.state === 'blank') {
      add($results, notice('blank', '묘사가 비어 있습니다', [
        '아무것도 찾지 않았습니다. 신고자가 말한 대로 물건의 종류, 색, 달린 것을 적어 주세요.',
        '예: 검은 지갑에 곰돌이 열쇠고리'
      ]));
      return;
    }
    add($results, echoBlock(res));

    if (res.state === 'need-more') {
      add($results, notice('need-more',
        res.reason === 'weak-only' ? '색이나 장소만으로는 후보를 고를 수 없습니다' : '찾는 데 쓸 말을 찾지 못했습니다',
        ['후보를 지어내지 않습니다. 물건을 가리키는 말을 더 적어 주세요.', askMore()]));
      return;
    }
    if (res.state === 'not-found') {
      var mockBtn = el('button', 'btn btn-line mock-report', '분실 신고로 남겨 두기 (모의)');
      mockBtn.type = 'button';
      var box = notice('not-found', '습득물 대장에서 겹치는 후보를 찾지 못했습니다', [
        '습득물 대장 ' + res.total + '건에 겹치는 말이 없습니다. 후보를 지어내지 않습니다.',
        '‘없다’고 단정하지도 않습니다. 아직 운영본부에 들어오지 않았을 수 있습니다.',
        mockBtn
      ]);
      mockBtn.addEventListener('click', function () {
        mockBtn.disabled = true;
        add(box, el('p', 'mock', '모의 접수입니다. 실제로 저장되거나 전송되지 않습니다. 운영본부의 분실 신고 대장에 따로 적어 주세요.'));
      });
      add($results, box);
      return;
    }

    var n = res.candidates.length;
    if (res.state === 'ambiguous') {
      add($results, notice('ambiguous', '이 묘사만으로는 가릴 수 없습니다', [
        '겹치는 말이 똑같은 후보가 ' + res.tieCount + '건입니다. 어느 것인지 고르지 않습니다.',
        askMore()
      ]));
    }
    var sum = el('p', 'summary');
    sum.textContent = '습득물 대장 ' + res.total + '건 가운데 겹치는 말이 있는 후보는 ' + n + '건입니다. ' +
      '글자가 많이 겹치는 것부터 보여 주며, 순서가 같은 물건일 가능성을 뜻하지는 않습니다.';
    add($results, sum, srcTag('습득물 대장(가상 데이터) ' + res.total + '건'), caution());
    add($results, candList(res.candidates, res.state === 'ambiguous' ? Math.max(res.tieCount, FIRST_SHOWN) : FIRST_SHOWN));
  }

  function run() {
    render(search($input.value));
    if (global.matchMedia && global.matchMedia('(max-width: 959px)').matches) {
      $results.scrollIntoView({ block: 'start' });
    }
  }

  $form.addEventListener('submit', function (e) { e.preventDefault(); run(); });
  doc.getElementById('clear').addEventListener('click', function () {
    $input.value = '';
    while ($results.firstChild) $results.removeChild($results.firstChild);
    $results.setAttribute('data-state', 'idle');
    add($results, el('p', 'idle', '묘사를 적고 ‘후보 찾기’를 누르면 여기에 후보가 나옵니다.'));
    $input.focus();
  });
  var ex = doc.querySelectorAll('.example');
  for (var i = 0; i < ex.length; i++) {
    ex[i].addEventListener('click', function () { $input.value = this.getAttribute('data-text'); run(); });
  }

  // 습득물 대장 전체 보기
  var $rows = doc.getElementById('ledger-rows');
  ITEMS.forEach(function (it) {
    var tr = el('tr');
    ['번호', '종류', '묘사', '습득장소', '습득시각', '보관위치'].forEach(function (k) {
      var td = el('td');
      if (it.raw[k]) td.textContent = it.raw[k];
      else add(td, el('span', 'need-check', '확인 필요'));
      add(tr, td);
    });
    add($rows, tr);
  });
  doc.getElementById('ledger-count').textContent = String(ITEMS.length);
})(typeof window !== 'undefined' ? window : this);
