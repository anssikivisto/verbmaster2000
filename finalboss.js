/* FINAL BOSS: Katsuyoshi -> Syntax Prime -> Ultimate Quest Combo
 * Erillinen moduuli. Käyttö:
 *   FinalBoss.start({ container, verbs, audio, music, onVictory, onDefeat, onExit, cutscene })
 *   FinalBoss.stop()
 * Kuvat ja musiikit haetaan suhteellisilla poluilla (sivun kansiosta); puuttuvan kuvan tilalle tulee laatikko.
 */
(function (global) {
  'use strict';

  // ---- Tiedostonimet (muokkaa tästä) ----
  const SPRITES = { boss1: 'bosskatsu.gif', boss2: 'sprime.gif', hero: 'herofinal.gif' };
  const MUSIC = { p1: '', p2: '', fin: '' };   // esim. { p1: 'boss1.mp3', p2: 'boss2.mp3', fin: 'finale.mp3' }

  // ---- Tasapaino (kaikki säädettävissä start({config:{...}}) ) ----
  const CFG = {
    playerHP: 100,
    p1BossHP: 160, p1Time: 4, p1Dmg: 20, p1BossDmg: 15,
    p2Shield: 8, p2Core: 12, p2Time: 7, p2PlayerDmg: 20,
    finTime: 14, finPlayerDmg: 30, finisherAt: 0.15
  };

  const FALLBACK_VERBS = [
    ['drive', 'drove', 'driven', 'ajaa'], ['take', 'took', 'taken', 'ottaa'], ['go', 'went', 'gone', 'mennä'],
    ['buy', 'bought', 'bought', 'ostaa'], ['run', 'ran', 'run', 'juosta'], ['see', 'saw', 'seen', 'nähdä'],
    ['eat', 'ate', 'eaten', 'syödä'], ['write', 'wrote', 'written', 'kirjoittaa'], ['speak', 'spoke', 'spoken', 'puhua'],
    ['swim', 'swam', 'swum', 'uida'], ['sing', 'sang', 'sung', 'laulaa'], ['catch', 'caught', 'caught', 'ottaa kiinni'],
    ['fly', 'flew', 'flown', 'lentää'], ['know', 'knew', 'known', 'tietää'], ['give', 'gave', 'given', 'antaa'],
    ['begin', 'began', 'begun', 'alkaa'], ['choose', 'chose', 'chosen', 'valita'], ['throw', 'threw', 'thrown', 'heittää'],
    ['teach', 'taught', 'taught', 'opettaa'], ['break', 'broke', 'broken', 'rikkoa'], ['strike', 'struck', 'stricken', 'iskeä']
  ].map(a => ({ base: a[0], past: a[1], participle: a[2], finnish: a[3] }));

  // ---- Apufunktiot (puhtaita, testattavissa) ----
  const up = s => String(s).trim().toUpperCase();
  const forms = (v, k) => String(v[k]).split('/').map(up);          // "was / were" -> ["WAS","WERE"]
  const accepts = (v, k, input) => forms(v, k).includes(up(input));
  const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const pick = a => a[Math.floor(Math.random() * a.length)];
  function regular(base) {                                            // väärä "säännöllistetty" muoto: TAKED, GOED
    const b = String(base).toLowerCase();
    if (/e$/.test(b)) return up(b + 'd');
    if (/[^aeiou]y$/.test(b)) return up(b.slice(0, -1) + 'ied');
    return up(b + 'ed');
  }
  // Monivalinta: 1 oikea + 3 harhauttajaa (vain epäsäännöllisten verbien sisällä)
  function choices(v, kind, verbs) {
    const own = new Set(), others = new Set();
    const ok = x => x && !forms(v, kind).includes(x);
    const addOwn = x => { x = up(x); if (ok(x)) own.add(x); };
    addOwn(regular(v.base));
    addOwn(kind === 'past' ? forms(v, 'participle')[0] : forms(v, 'past')[0]);
    addOwn(v.base);
    shuffle(verbs.filter(o => o !== v)).forEach(o => { const x = forms(o, kind)[0]; if (ok(x) && !own.has(x)) others.add(x); });
    // kaksi harhauttajaa samasta verbistä, loput muista verbeistä
    const bad = shuffle(Array.from(own)).slice(0, 2);
    Array.from(others).concat(Array.from(own)).forEach(x => { if (bad.length < 3 && !bad.includes(x)) bad.push(x); });
    if (bad.length < 3) bad.push(up(v.base) + 'EN');
    return shuffle([forms(v, kind)[0]].concat(bad.slice(0, 3)));
  }

  const CSS = `
.fb-root{position:absolute;inset:0;display:grid;grid-template-rows:25% 37% 38%;background:#07011a;color:#fff;font-family:'Press Start 2P',monospace;overflow:hidden;user-select:none}
.fb-root *{box-sizing:border-box}
.fb-top{padding:.8em 1.2em;display:flex;flex-direction:column;gap:.5em;border-bottom:.2em solid #22e6ff;background:#0d0630}
.fb-name{font-size:1em;color:#ff2e97}
.fb-bar{height:1.1em;border:.15em solid #fff;background:#1a0a40}
.fb-bar>i{display:block;height:100%;width:100%;background:#ff2e97;transition:width .3s}
.fb-bar.shield>i{background:#ffe600}.fb-bar.hide{display:none}
.fb-msg{flex:1;border:.2em solid #22e6ff;background:#000;padding:.7em .9em;font-size:.95em;line-height:1.6;color:#22e6ff;overflow:hidden}
.fb-msg.red{color:#ff4d4d;border-color:#ff4d4d}.fb-msg.good{color:#7dff7d;border-color:#7dff7d}
.fb-field{position:relative;background:linear-gradient(#12063a,#2a0d5c 70%,#ff2e97 140%);overflow:hidden}
.fb-field:before{content:'';position:absolute;inset:0;background:repeating-linear-gradient(0deg,rgba(34,230,255,.07) 0 .15em,transparent .15em .6em)}
.fb-spr{position:absolute;bottom:6%;height:78%;display:flex;align-items:flex-end}
.fb-spr img{height:100%;image-rendering:pixelated}
.fb-hero{left:10%}.fb-boss{right:10%}
.fb-ph{height:100%;aspect-ratio:3/4;border:.2em dashed #fff;display:flex;align-items:center;justify-content:center;text-align:center;font-size:.7em;background:rgba(255,255,255,.12)}
.fb-float{position:absolute;font-size:1.3em;color:#ffe600;text-shadow:.12em .12em #000;animation:fbup 1s forwards;pointer-events:none}
.fb-word{position:absolute;top:30%;font-size:1.8em;color:#ff4d4d;text-shadow:.1em .1em #000;white-space:nowrap;animation:fbfly linear forwards}
.fb-fx{position:absolute;inset:0;pointer-events:none}
.fb-cmd{padding:.9em 1.4em;display:flex;flex-direction:column;gap:.7em;background:#0d0630;border-top:.2em solid #ff2e97}
.fb-label{font-size:.8em;color:#ffe600}
.fb-big{font-size:1.5em;color:#fff}.fb-sub{font-size:.7em;color:#9ad;margin-left:.6em}
.fb-opts{display:grid;grid-template-columns:1fr 1fr;gap:.6em}
.fb-opt{font:inherit;font-size:.95em;padding:.8em;background:#1a0a40;color:#fff;border:.2em solid #22e6ff;cursor:pointer;text-align:left}
.fb-opt:hover{background:#2a1670}.fb-opt.ok{background:#0a5a0a;border-color:#7dff7d}.fb-opt.no{background:#5a0a0a;border-color:#ff4d4d}
.fb-input{font:inherit;font-size:1.3em;padding:.6em;background:#000;color:#fff;border:.2em solid #22e6ff;text-transform:uppercase;outline:none;width:100%}
.fb-timer{height:.9em;border:.15em solid #fff;background:#1a0a40}.fb-timer>i{display:block;height:100%;width:100%;background:#22e6ff}
.fb-php{display:flex;align-items:center;gap:.7em;font-size:.7em}.fb-php .fb-bar{flex:1;height:.9em}.fb-php .fb-bar>i{background:#7dff7d}
.fb-overlay{position:absolute;inset:0;display:none;align-items:center;justify-content:center;flex-direction:column;gap:1.2em;background:rgba(0,0,0,.88);text-align:center;font-size:1em;line-height:1.8;z-index:5;padding:2em}
.fb-overlay.on{display:flex}
.fb-overlay h2{font-size:1.8em;margin:0}
.fb-btn{font:inherit;padding:.9em 1.4em;background:#ff2e97;color:#fff;border:.2em solid #fff;cursor:pointer}
.fb-shake{animation:fbshake .35s}.fb-flash{animation:fbflash .5s}
.fb-glitch{animation:fbglitch .25s steps(2) infinite}
.fb-dissolve{animation:fbdis 2.2s steps(10) forwards}
.fb-kneel{transform:translateY(12%) rotate(8deg);transition:transform 1.2s}
.fb-noise:after{content:'';position:absolute;inset:0;background:repeating-linear-gradient(0deg,rgba(255,255,255,.18) 0 .2em,rgba(0,0,0,.4) .2em .5em);animation:fbglitch .12s steps(2) infinite;z-index:3}
.fb-err{color:#ff4d4d;font-size:1.6em}
@keyframes fbup{to{transform:translateY(-3em);opacity:0}}
@keyframes fbfly{from{right:-30%}to{right:60%}}
@keyframes fbshake{25%{transform:translateX(-.6em)}75%{transform:translateX(.6em)}}
@keyframes fbflash{0%{filter:brightness(4)}100%{filter:none}}
@keyframes fbglitch{0%{transform:translate(0) skewX(0);filter:hue-rotate(0)}50%{transform:translate(-.5em,.2em) skewX(8deg);filter:hue-rotate(90deg)}100%{transform:translate(.5em,-.2em) skewX(-6deg);filter:hue-rotate(200deg)}}
@keyframes fbdis{0%{opacity:1;filter:none}60%{opacity:.6;filter:contrast(3) blur(.3em)}100%{opacity:0;transform:scale(.2,1.6);filter:blur(1em)}}
`;

  let current = null;
  function stop() { if (current) { current.destroy(); current = null; } }

  function start(opts) {
    stop();
    const o = opts || {};
    const C = Object.assign({}, CFG, o.config || {});
    const SP = Object.assign({}, SPRITES, o.sprites || {});
    const MU = Object.assign({}, MUSIC, o.music || {});
    const A = o.audio || null;
    const sfx = n => { try { if (A && A[n]) A[n](); } catch (e) { } };
    const music = k => { try { if (A && A.playBGM && MU[k]) A.playBGM(MU[k]); } catch (e) { } };
    const tScale = o.timeScale || 1;
    const verbs = ((o.verbs && o.verbs.length >= 8) ? o.verbs : FALLBACK_VERBS).filter(v => v.base && v.past && v.participle);
    const host = o.container || document.body;

    // ---- DOM ----
    const style = document.createElement('style'); style.textContent = CSS; document.head.appendChild(style);
    const root = document.createElement('div'); root.className = 'fb-root';
    root.innerHTML = `
      <div class="fb-top"><div class="fb-name"></div><div class="fb-bar shield hide"><i></i></div><div class="fb-bar core"><i></i></div><div class="fb-msg"></div></div>
      <div class="fb-field"><div class="fb-spr fb-hero"></div><div class="fb-spr fb-boss"></div><div class="fb-fx"></div></div>
      <div class="fb-cmd"><div class="fb-label"></div><div class="fb-qrow"><span class="fb-big"></span><span class="fb-sub"></span></div>
        <div class="fb-opts"></div><input class="fb-input" autocomplete="off" spellcheck="false" style="display:none">
        <div class="fb-timer"><i></i></div><div class="fb-php"><span>HP</span><div class="fb-bar"><i></i></div></div></div>
      <div class="fb-overlay"></div>`;
    if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
    host.appendChild(root);
    const q = c => root.querySelector('.' + c);
    const fit = () => { root.style.fontSize = (root.clientWidth / 64) + 'px'; };
    fit(); const ro = (typeof ResizeObserver !== 'undefined') ? new ResizeObserver(fit) : null; if (ro) ro.observe(root);

    function sprite(slot, src, label) {
      const box = q(slot); box.innerHTML = '';
      const img = new Image(); img.src = src; img.alt = label;
      img.onerror = () => { box.innerHTML = '<div class="fb-ph">' + label + '<br>(' + src + ')</div>'; };
      box.appendChild(img);
    }

    // ---- Tila ----
    const S = { phase: '', pHP: C.playerHP, bHP: 0, shield: 0, core: 0, combo: 0, t: 0, tMax: 1, timerOn: false,
      locked: true, qn: null, turn: 'defend', last: null, checkpoint: 'p1', fin: null, finStep: 0,
      stats: { correct: 0, wrong: 0, missed: {} }, dead: false };
    const timeouts = new Set();
    const later = (fn, ms) => { const id = setTimeout(() => { timeouts.delete(id); fn(); }, ms); timeouts.add(id); return id; };
    const seq = steps => steps.forEach(s => later(s[1], s[0]));

    function msg(text, cls) { const m = q('fb-msg'); m.textContent = text; m.className = 'fb-msg ' + (cls || ''); }
    function say(lines, done) {   // näyttää repliikit peräkkäin
      let t = 0; lines.forEach(l => { later(() => msg(l), t); t += 1700; }); later(done || (() => { }), t);
    }
    function fx(el, cls, ms) { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); if (ms) later(() => el.classList.remove(cls), ms); }
    function floatTxt(text, slot, color) {
      const f = document.createElement('div'); f.className = 'fb-float'; f.textContent = text; f.style.color = color || '#ffe600';
      f.style.bottom = '55%'; f.style[slot === 'hero' ? 'left' : 'right'] = '14%'; q('fb-field').appendChild(f); later(() => f.remove(), 1000);
    }
    function render() {
      q('fb-php').querySelector('i').style.width = Math.max(0, S.pHP / C.playerHP * 100) + '%';
      const core = root.querySelector('.fb-bar.core');
      const sh = root.querySelector('.fb-bar.shield');
      if (S.phase === 'p1') core.firstChild.style.width = Math.max(0, S.bHP / C.p1BossHP * 100) + '%';
      else { core.firstChild.style.width = Math.max(0, S.core / C.p2Core * 100) + '%'; sh.firstChild.style.width = Math.max(0, S.shield / C.p2Shield * 100) + '%'; }
    }
    function hurtPlayer(n) {
      if (!o.invincible) S.pHP = Math.max(0, S.pHP - n);
      fx(q('fb-hero'), 'fb-shake', 400); fx(root, 'fb-flash', 500); sfx('playWrong'); floatTxt('-' + n, 'hero', '#ff4d4d'); render();
    }

    // ---- Kysymysnäkymä ----
    function showQ(label, big, sub, mode, opts4) {
      q('fb-label').textContent = label; q('fb-big').textContent = big; q('fb-sub').textContent = sub || '';
      const box = q('fb-opts'), inp = q('fb-input'); box.innerHTML = '';
      if (mode === 'choice') {
        inp.style.display = 'none'; box.style.display = 'grid';
        opts4.forEach((w, i) => {
          const b = document.createElement('button'); b.className = 'fb-opt'; b.textContent = (i + 1) + '  ' + w; b.dataset.w = w;
          b.onclick = () => answerChoice(w); box.appendChild(b);
        });
      } else { box.style.display = 'none'; inp.style.display = 'block'; inp.value = ''; inp.focus(); }
    }
    function startTimer(sec) { S.tMax = sec * tScale; S.t = S.tMax; S.timerOn = true; S.locked = false; }
    function stopTimer() { S.timerOn = false; S.locked = true; }
    function weightedVerb() {
      const pool = []; verbs.forEach(v => { if (v === S.last && verbs.length > 1) return; const n = 1 + 2 * (S.stats.missed[v.base] || 0); for (let i = 0; i < n; i++) pool.push(v); });
      return (S.last = pick(pool));
    }
    function miss(v) { S.stats.missed[v.base] = (S.stats.missed[v.base] || 0) + 1; S.stats.wrong++; S.combo = 0; }

    // ---- Vaihe 1: Katsuyoshi (monivalinta) ----
    function beginP1() {
      S.phase = 'p1'; S.checkpoint = 'p1'; S.pHP = C.playerHP; S.bHP = C.p1BossHP; S.combo = 0; S.turn = 'defend'; S.dead = false;
      root.querySelector('.fb-bar.shield').classList.add('hide'); q('fb-name').textContent = 'BOSS KATSUYOSHI';
      sprite('fb-boss', SP.boss1, 'KATSUYOSHI'); sprite('fb-hero', SP.hero, 'HERO'); music('p1'); render(); stopTimer();
      showQ('', '', '', 'choice', []);
      const go = () => say(["Well, well, well...", "You've learned a few verbs, haven't you?", "Your little vocabulary trip ends here!", "Prepare to lose!"], p1Turn);
      cut('boss_phase1', go);
    }
    function p1Turn() {
      if (S.phase !== 'p1') return;
      const v = weightedVerb(), defend = S.turn === 'defend', kind = defend ? 'past' : 'participle';
      S.qn = { v, kind, correct: forms(v, kind)[0] };
      msg(defend ? 'I WILL ' + up(v.base) + ' YOU!' : 'Your move! Strike with ' + up(v.base) + '!');
      showQ(defend ? 'PUOLUSTA: PAST SIMPLE (2. muoto)' : 'HYÖKKÄÄ: PAST PARTICIPLE (3. muoto)', up(v.base), v.finnish, 'choice', choices(v, kind, verbs));
      startTimer(C.p1Time);
    }
    function answerChoice(w) {
      if (S.locked || S.phase !== 'p1') return;
      stopTimer();
      const n = S.qn, ok = accepts(n.v, n.kind, w);
      root.querySelectorAll('.fb-opt').forEach(b => { if (b.dataset.w === n.correct) b.classList.add('ok'); else if (b.dataset.w === w) b.classList.add('no'); });
      resolveP1(ok);
    }
    function resolveP1(ok) {
      const n = S.qn;
      if (ok) {
        S.stats.correct++; S.combo++;
        const dmg = Math.round(C.p1Dmg * (1 + 0.25 * Math.min(S.combo - 1, 4)));
        S.bHP = Math.max(0, S.bHP - dmg); sfx('playCorrect'); sfx('playHit'); fx(q('fb-boss'), 'fb-shake', 400); floatTxt('-' + dmg, 'boss');
        msg(S.turn === 'defend' ? 'Parried! ' + n.correct + '!' : 'Direct hit! ' + n.correct + '!', 'good');
      } else {
        miss(n.v);
        if (S.turn === 'defend') { hurtPlayer(C.p1BossDmg); } else { sfx('playWrong'); }
        msg('Oikea muoto: ' + n.correct, 'red');
      }
      render(); S.turn = S.turn === 'defend' ? 'attack' : 'defend';
      later(() => { if (S.bHP <= 0) transition(); else if (S.pHP <= 0) defeat(); else p1Turn(); }, 1500);
    }

    // ---- Siirtymä: valekuolema ----
    function transition() {
      S.phase = 'trans'; stopTimer(); try { A && A.stopBGM && A.stopBGM(); } catch (e) { }
      const f = q('fb-field'), b = q('fb-boss');
      seq([
        [0, () => { msg('...'); b.classList.add('fb-kneel'); }],
        [1500, () => { f.classList.add('fb-noise'); fx(root, 'fb-glitch'); sfx('playExplosion'); }],
        [2300, () => { root.classList.remove('fb-glitch'); fx(root, 'fb-flash', 500); root.style.background = '#600'; b.classList.add('fb-dissolve'); }],
        [3500, () => { root.style.background = '#07011a'; showOverlayHtml('<div class="fb-err">ERROR:<br>ACTION NOT TERMINATED.</div>'); }],
        [5200, () => { hideOverlay(); f.classList.remove('fb-noise'); b.classList.remove('fb-kneel', 'fb-dissolve'); beginP2(); }]
      ]);
    }

    // ---- Vaihe 2: Syntax Prime (kirjoitus) ----
    function beginP2() {
      S.phase = 'p2'; S.checkpoint = 'p2'; S.pHP = C.playerHP; S.shield = C.p2Shield; S.core = C.p2Core; S.combo = 0; S.dead = false;
      root.querySelector('.fb-bar.shield').classList.remove('hide'); q('fb-name').textContent = 'SYNTAX PRIME';
      sprite('fb-boss', SP.boss2, 'SYNTAX PRIME'); sprite('fb-hero', SP.hero, 'HERO'); music('p2'); render();
      showQ('', '', '', 'type');
      cut('boss_phase2', () => say(["You thought it would be this easy?", "Well think again!"], p2Turn));
    }
    function p2Turn() {
      if (S.phase !== 'p2') return;
      if (S.shield <= 0 && S.core <= Math.max(1, Math.floor(C.p2Core * C.finisherAt))) return beginFinisher();
      const v = weightedVerb(), kind = pick(['past', 'participle']), bad = regular(v.base);
      S.qn = { v, kind, correct: forms(v, kind)[0], bad };
      msg(S.shield > 0 ? 'CORRUPTED CODE! Purify it to break the shield!' : 'The shield is down! Strike the core!');
      showQ('KORJAA: ' + (kind === 'past' ? 'PAST SIMPLE (2. muoto)' : 'PAST PARTICIPLE (3. muoto)'), bad, '(' + v.base + ' - ' + v.finnish + ')', 'type');
      const w = document.createElement('div'); w.className = 'fb-word'; w.textContent = bad; w.style.animationDuration = (C.p2Time * tScale) + 's';
      q('fb-field').appendChild(w); S.qn.word = w;
      startTimer(C.p2Time);
    }
    function answerTyped(text) {
      if (S.locked) return;
      if (S.phase === 'p2') {
        stopTimer(); const n = S.qn, ok = accepts(n.v, n.kind, text); if (n.word) n.word.remove();
        if (ok) {
          S.stats.correct++; S.combo++; sfx('playCorrect'); sfx('playHit'); fx(q('fb-boss'), 'fb-shake', 400);
          if (S.shield > 0) { S.shield--; floatTxt('SHIELD -1', 'boss'); msg(S.shield > 0 ? 'Purified! ' + n.correct : 'SHIELD BROKEN!', 'good'); }
          else { S.core--; floatTxt('CORE HIT', 'boss', '#ff2e97'); msg('Core hit! ' + n.correct, 'good'); }
        } else {
          miss(n.v); hurtPlayer(C.p2PlayerDmg); msg('The corrupted word hits you! Oikea muoto: ' + n.correct, 'red');
        }
        render(); later(() => { if (S.pHP <= 0) defeat(); else p2Turn(); }, 1400);
      } else if (S.phase === 'fin') finStepAnswer(text);
    }

    // ---- Finaali: Ultimate Quest Combo ----
    const STEPS = [['infinitive', 'base', 'MIEKANVETO!'], ['past simple', 'past', 'KYBER-LAUKAUS!'], ['past participle', 'participle', 'LOPULLINEN RÄJÄHDYS!']];
    function hardVerbs() {
      const h = verbs.filter(v => up(v.base) !== up(v.past) && up(v.past) !== up(v.participle) && up(v.base) !== up(v.participle) && !/\//.test(v.past + v.participle));
      return h.length ? h : verbs;
    }
    function beginFinisher() {
      S.phase = 'fin'; stopTimer(); music('fin'); q('fb-name').textContent = 'SYNTAX PRIME: ABSOLUTE STASIS';
      msg('ABSOLUTE STASIS CHARGING! Type all three forms!', 'red'); fx(root, 'fb-glitch', 1200);
      showQ('', '', '', 'type'); q('fb-input').disabled = true;
      later(() => { q('fb-input').disabled = false; finRound(); }, 1500);
    }
    function finRound() {
      S.fin = pick(hardVerbs()); S.finStep = 0; S.last = S.fin;
      finShow(); startTimer(C.finTime);
    }
    function finShow() {
      const st = STEPS[S.finStep], v = S.fin;
      showQ('COMBO ' + (S.finStep + 1) + '/3: ' + st[0].toUpperCase(), up(v.base), v.finnish + (S.finStep ? '  [' + STEPS.slice(0, S.finStep).map(x => up(v[x[1]])).join(' > ') + ']' : ''), 'type');
    }
    function finStepAnswer(text) {
      const v = S.fin, st = STEPS[S.finStep];
      if (accepts(v, st[1], text)) {
        sfx('playHit'); fx(q('fb-boss'), 'fb-shake', 400); floatTxt(st[2], 'boss', '#ffe600'); msg(st[2] + ' ' + up(v[st[1]]), 'good'); S.finStep++;
        if (S.finStep >= 3) { S.stats.correct += 3; stopTimer(); return victory(); }
        finShow();
      } else {
        S.t = Math.max(0.1, S.t - 1); S.stats.wrong++; S.stats.missed[v.base] = (S.stats.missed[v.base] || 0) + 1;
        sfx('playWrong'); fx(q('fb-cmd'), 'fb-shake', 350); q('fb-input').value = ''; msg('Wrong form! (-1 s)', 'red');
      }
    }

    // ---- Voitto ja tappio ----
    function victory() {
      S.phase = 'win'; stopTimer(); const b = q('fb-boss');
      seq([
        [0, () => { msg('...'); fx(root, 'fb-glitch', 1500); sfx('playExplosion'); }],
        [800, () => { b.classList.add('fb-dissolve'); sfx('playExplosion'); }],
        [3200, () => cut('cutscene_win', () => say(["Impossible...", "You... you have mastered all the verbs!", "My powers are gone..."], results))]
      ]);
    }
    function results() {
      const s = S.stats, tot = s.correct + s.wrong, acc = tot ? Math.round(s.correct / tot * 100) : 100;
      const m = Object.keys(s.missed).sort((a, b) => s.missed[b] - s.missed[a]).slice(0, 6).map(x => x.toUpperCase()).join(', ') || '-';
      showOverlayHtml('<h2 style="color:#7dff7d">VICTORY!</h2>Tarkkuus: ' + acc + ' %<br>Oikein: ' + s.correct + ' / Väärin: ' + s.wrong + '<br>Hankalimmat verbit: ' + m + '<br><button class="fb-btn">JATKA</button>');
      root.querySelector('.fb-overlay .fb-btn').onclick = () => { const st = { correct: s.correct, wrong: s.wrong, accuracy: acc, missed: Object.keys(s.missed) }; stop(); if (o.onVictory) o.onVictory(st); };
    }
    function defeat() {
      if (S.dead) return; S.dead = true; S.phase = 'lost'; stopTimer(); sfx('playExplosion'); if (S.fin) S.fin = null;
      q('fb-field').querySelectorAll('.fb-word').forEach(w => w.remove());
      showOverlayHtml('<h2 style="color:#ff4d4d">GAME OVER</h2>' + (S.checkpoint === 'p2' ? 'Jatkat Syntax Primen taistelun alusta.' : '') +
        '<br><button class="fb-btn" data-a="retry">YRITÄ UUDELLEEN</button> <button class="fb-btn" data-a="exit">POISTU</button>');
      root.querySelectorAll('.fb-overlay .fb-btn').forEach(b => b.onclick = () => {
        if (b.dataset.a === 'retry') { hideOverlay(); S.checkpoint === 'p2' ? beginP2() : beginP1(); }
        else { stop(); if (o.onDefeat) o.onDefeat(); if (o.onExit) o.onExit(); }
      });
    }
    function timeout() {
      stopTimer();
      if (S.phase === 'p1') { const n = S.qn; root.querySelectorAll('.fb-opt').forEach(b => { if (b.dataset.w === n.correct) b.classList.add('ok'); }); msg('Too slow! Oikea muoto: ' + n.correct, 'red'); miss(n.v); if (S.turn === 'defend') hurtPlayer(C.p1BossDmg); S.turn = S.turn === 'defend' ? 'attack' : 'defend'; later(() => { if (S.pHP <= 0) defeat(); else p1Turn(); }, 1500); }
      else if (S.phase === 'p2') { const n = S.qn; if (n.word) n.word.remove(); miss(n.v); hurtPlayer(C.p2PlayerDmg); msg('Time out! Oikea muoto: ' + n.correct, 'red'); later(() => { if (S.pHP <= 0) defeat(); else p2Turn(); }, 1400); }
      else if (S.phase === 'fin') { hurtPlayer(C.finPlayerDmg); msg('STASIS HITS YOU! Try again!', 'red'); later(() => { if (S.pHP <= 0) defeat(); else finRound(); }, 1500); }
    }

    // ---- Overlay, cutscenet ----
    function showOverlayHtml(h) { const ov = q('fb-overlay'); ov.innerHTML = h; ov.classList.add('on'); const b = ov.querySelector('.fb-btn'); if (b) b.focus(); }
    function hideOverlay() { q('fb-overlay').classList.remove('on'); }
    function cut(id, next) { if (o.cutscene) o.cutscene(id, next); else next(); }

    // ---- Syötteet ja ajastin ----
    const inp = q('fb-input');
    const onInputKey = e => { if (e.key === 'Enter') { const t = inp.value; if (t.trim()) { inp.value = ''; answerTyped(t); } e.preventDefault(); } e.stopPropagation(); };
    inp.addEventListener('keydown', onInputKey);
    const onKey = e => {
      if (S.phase === 'p1' && !S.locked && /^[1-4]$/.test(e.key)) { const b = root.querySelectorAll('.fb-opt')[+e.key - 1]; if (b) b.click(); }
      else if ((S.phase === 'p2' || S.phase === 'fin') && document.activeElement !== inp && !S.locked) inp.focus();
    };
    document.addEventListener('keydown', onKey);
    let raf = 0, lastT = performance.now();
    const tick = now => {
      const dt = Math.min(0.1, (now - lastT) / 1000); lastT = now;   // välilehden piilotus ei kuluta aikaa
      if (S.timerOn) {
        S.t -= dt; q('fb-timer').firstChild.style.width = Math.max(0, S.t / S.tMax * 100) + '%';
        if (S.t <= 0) timeout();
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    current = {
      destroy() {
        cancelAnimationFrame(raf); timeouts.forEach(clearTimeout); timeouts.clear();
        document.removeEventListener('keydown', onKey); if (ro) ro.disconnect();
        try { A && A.stopBGM && A.stopBGM(); } catch (e) { }
        root.remove(); style.remove();
      }
    };

    const at = o.startAt || 'p1';
    if (at === 'p2') beginP2();
    else if (at === 'finisher') {   // kehittäjän oikopolku suoraan finaaliin
      S.phase = 'p2'; S.checkpoint = 'p2'; S.pHP = C.playerHP; S.shield = 0; S.core = 1;
      sprite('fb-boss', SP.boss2, 'SYNTAX PRIME'); sprite('fb-hero', SP.hero, 'HERO');
      root.querySelector('.fb-bar.shield').classList.remove('hide'); render(); beginFinisher();
    } else beginP1();
  }

  global.FinalBoss = { start, stop, _test: { regular, choices, accepts, forms } };
})(typeof window !== 'undefined' ? window : globalThis);
