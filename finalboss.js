/* FINAL BOSS: Katsuyoshi (monivalinta) -> Syntax Prime (3 vs 1, kirjoitus) -> Ultimate Quest Combo
 * Käyttö:  FinalBoss.start({ container, verbs, audio, music, cutscene, onVictory, onDefeat, onExit })   FinalBoss.stop()
 * Kuvat ja musiikit haetaan suhteellisilla poluilla; puuttuvan kuvan tilalla on laatikko.
 */
(function (global) {
  'use strict';

  // ---- Tiedostonimet (muokkaa tästä) ----
  const SPRITES = { boss1: 'bosskatsu.gif', boss2: 'sprime.gif', hero: 'herofinal.gif', roxy: 'roxyfinal.gif', cap: 'capfinal.gif' };
  const MUSIC = { p1: '', p2: '', fin: '' };   // esim. { p1: 'boss1.mp3', p2: 'boss2.mp3', fin: 'finale.mp3' }

  // ---- Tasapaino (säädettävissä start({config:{...}}) ) ----
  const CFG = {
    p1BossHP: 160, p1Time: 6, p1Dmg: 20, p1BossDmg: 15,
    heroHP: 100, roxyHP: 60, capHP: 80,
    heroTime: 7, roxyTime: 5, capTime: 12,        // sekuntia: yksi muoto / yksi verbi (x2) / kolme muotoa yhteensä
    heroDmg: 20, roxyDmg: 8, capDmg: 17,          // Hero: 1 muoto, Roxy: 2 x 8, Captain: 3 x 17
    p2Shield: 80, p2Core: 140, primeTime: 7, primeDmg: 25, roxyBonus: 2,
    finisherAt: 0.15, finisherAtSolo: 0.30,       // ytimen osuus, jolla finaali alkaa (solo = molemmat apurit väsyneet)
    finTime: 14, finPlayerDmg: 30
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
  const clean = s => String(s).replace(/\s+/g, ' ').trim();
  const up = s => clean(s).toUpperCase();
  // "woke (up)" -> ["WOKE UP","WOKE"], "got/gotten" -> ["GOT","GOTTEN"], "was / were" -> ["WAS","WERE"]
  function variants(str) {
    const out = [];
    String(str).split('/').forEach(p => {
      p = clean(p); if (!p) return;
      [clean(p.replace(/[()]/g, '')), clean(p.replace(/\(.*?\)/g, ''))].forEach(x => { x = x.toUpperCase(); if (x && !out.includes(x)) out.push(x); });
    });
    return out;
  }
  const forms = (v, k) => variants(v[k]);
  const accepts = (v, k, input) => forms(v, k).includes(up(input));
  const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const pick = a => a[Math.floor(Math.random() * a.length)];
  function regular(base) {                                            // väärä "säännöllistetty" muoto: TAKED, GOED
    const b = clean(String(base).replace(/\(.*?\)/g, '')).toLowerCase();
    if (/e$/.test(b)) return up(b + 'd');
    if (/[^aeiou]y$/.test(b)) return up(b.slice(0, -1) + 'ied');
    return up(b + 'ed');
  }
  // Korruptoitu sana ei saa olla oikea muoto (showed, dived, dreamed...)
  const corruptOK = (v, kind) => !forms(v, kind).includes(regular(v.base));
  // Verbit, joissa kaikki kolme muotoa eroavat eikä ole vaihtoehtoja
  const isHard = v => up(v.base) !== up(v.past) && up(v.past) !== up(v.participle) && up(v.base) !== up(v.participle) && !/[\/(]/.test(v.past + v.participle);
  // Monivalinta: 1 oikea + 3 harhauttajaa (kaksi samasta verbistä, yksi muualta)
  function choices(v, kind, verbs) {
    const own = new Set(), others = new Set(), right = forms(v, kind);
    const ok = x => x && !right.includes(x);
    const addOwn = x => { x = up(x); if (ok(x)) own.add(x); };
    addOwn(regular(v.base));
    addOwn(kind === 'past' ? forms(v, 'participle')[0] : forms(v, 'past')[0]);
    addOwn(variants(v.base)[0]);
    shuffle(verbs.filter(o => o !== v)).forEach(o => { const x = forms(o, kind)[0]; if (ok(x) && !own.has(x)) others.add(x); });
    const bad = shuffle(Array.from(own)).slice(0, 2);
    Array.from(others).concat(Array.from(own)).forEach(x => { if (bad.length < 3 && !bad.includes(x)) bad.push(x); });
    if (bad.length < 3) bad.push(up(v.base) + 'EN');
    return shuffle([right[0]].concat(bad.slice(0, 3)));
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
.fb-spr{position:absolute;bottom:6%;height:70%;display:flex;align-items:flex-end}
.fb-spr img{height:100%;image-rendering:pixelated}
.fb-hero{left:5%}.fb-roxy{left:23%;height:58%}.fb-cap{left:39%;height:58%}.fb-boss{right:8%;height:76%}
.fb-gone{display:none}
.fb-ph{height:100%;aspect-ratio:3/4;border:.2em dashed #fff;display:flex;align-items:center;justify-content:center;text-align:center;font-size:.6em;background:rgba(255,255,255,.12)}
.fb-pb{position:absolute;top:-2.6em;left:0;width:100%;font-size:.6em;white-space:nowrap}
.fb-pb .fb-bar{height:.9em}.fb-pb .fb-bar>i{background:#7dff7d}
.fb-target{animation:fbtarget .45s infinite alternate}
.fb-out{animation:fbout .9s forwards}.fb-in{animation:fbin .7s}
.fb-float{position:absolute;font-size:1.3em;color:#ffe600;text-shadow:.12em .12em #000;animation:fbup 1s forwards;pointer-events:none}
.fb-word{position:absolute;top:30%;font-size:1.8em;color:#ff4d4d;text-shadow:.1em .1em #000;white-space:nowrap;animation:fbfly linear forwards}
.fb-fx{position:absolute;inset:0;pointer-events:none}
.fb-cmd{padding:.9em 1.4em;display:flex;flex-direction:column;gap:.7em;background:#0d0630;border-top:.2em solid #ff2e97}
.fb-label{font-size:.8em;color:#ffe600}
.fb-big{font-size:1.5em;color:#fff}.fb-sub{font-size:.7em;color:#9ad;margin-left:.6em}
.fb-opts{display:grid;grid-template-columns:1fr 1fr;gap:.6em}
.fb-opt{font:inherit;font-size:.85em;padding:.8em;background:#1a0a40;color:#fff;border:.2em solid #22e6ff;cursor:pointer;text-align:left;line-height:1.5}
.fb-opt:hover{background:#2a1670}.fb-opt.ok{background:#0a5a0a;border-color:#7dff7d}.fb-opt.no{background:#5a0a0a;border-color:#ff4d4d}
.fb-input{font:inherit;font-size:1.3em;padding:.6em;background:#000;color:#fff;border:.2em solid #22e6ff;text-transform:uppercase;outline:none;width:100%}
.fb-timer{height:.9em;border:.15em solid #fff;background:#1a0a40}.fb-timer>i{display:block;height:100%;width:0;background:#22e6ff}
.fb-overlay{position:absolute;inset:0;display:none;align-items:center;justify-content:center;flex-direction:column;gap:1.2em;background:rgba(0,0,0,.88);text-align:center;font-size:1em;line-height:1.8;z-index:5;padding:2em}
.fb-overlay.on{display:flex}
.fb-overlay h2{font-size:1.8em;margin:0}
.fb-btn{font:inherit;padding:.9em 1.4em;background:#ff2e97;color:#fff;border:.2em solid #fff;cursor:pointer}
.fb-shake{animation:fbshake .35s}.fb-flash{animation:fbflash .5s}
.fb-glitch{animation:fbglitch .25s steps(2) infinite}
.fb-dissolve{animation:fbdis 3.6s steps(16) forwards}.fb-appear{animation:fbappear 2.4s}
.fb-kneel{transform:translateY(12%) rotate(8deg);transition:transform 1.2s}
.fb-noise:after{content:'';position:absolute;inset:0;background:repeating-linear-gradient(0deg,rgba(255,255,255,.18) 0 .2em,rgba(0,0,0,.4) .2em .5em);animation:fbglitch .12s steps(2) infinite;z-index:3}
.fb-err{color:#ff4d4d;font-size:1.6em}
@keyframes fbup{to{transform:translateY(-3em);opacity:0}}
@keyframes fbfly{from{right:-30%}to{right:60%}}
@keyframes fbshake{25%{transform:translateX(-.6em)}75%{transform:translateX(.6em)}}
@keyframes fbflash{0%{filter:brightness(4)}100%{filter:none}}
@keyframes fbglitch{0%{transform:translate(0) skewX(0);filter:hue-rotate(0)}50%{transform:translate(-.5em,.2em) skewX(8deg);filter:hue-rotate(90deg)}100%{transform:translate(.5em,-.2em) skewX(-6deg);filter:hue-rotate(200deg)}}
@keyframes fbdis{0%{opacity:1;filter:none}60%{opacity:.6;filter:contrast(3) blur(.3em)}100%{opacity:0;transform:scale(.2,1.6);filter:blur(1em)}}
@keyframes fbappear{0%{opacity:0;filter:brightness(6) blur(.4em);transform:scale(1.4)}60%{opacity:1;filter:brightness(2)}100%{opacity:1;filter:none;transform:none}}
@keyframes fbtarget{from{filter:drop-shadow(0 0 .1em #ff4d4d)}to{filter:drop-shadow(0 0 .9em #ff4d4d) brightness(1.3)}}
@keyframes fbout{0%{transform:none;opacity:1}100%{transform:translate(-220%,-70%) rotate(-540deg);opacity:0;visibility:hidden}}
@keyframes fbin{from{transform:translateX(-250%);opacity:0}to{transform:none;opacity:1}}
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
      <div class="fb-field"><div class="fb-spr fb-hero"></div><div class="fb-spr fb-roxy fb-gone"></div><div class="fb-spr fb-cap fb-gone"></div><div class="fb-spr fb-boss"></div><div class="fb-fx"></div></div>
      <div class="fb-cmd"><div class="fb-label"></div><div class="fb-qrow"><span class="fb-big"></span><span class="fb-sub"></span></div>
        <div class="fb-opts"></div><input class="fb-input" autocomplete="off" spellcheck="false" style="display:none">
        <div class="fb-timer"><i></i></div></div>
      <div class="fb-overlay"></div>`;
    if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
    host.appendChild(root);
    const q = c => root.querySelector('.' + c);
    const fit = () => { root.style.fontSize = (root.clientWidth / 64) + 'px'; };
    fit(); const ro = (typeof ResizeObserver !== 'undefined') ? new ResizeObserver(fit) : null; if (ro) ro.observe(root);

    // ---- Tila ----
    const mk = (name, slot, hp) => ({ name, slot, hp, max: hp, out: false });
    const S = { warned: false, lastActed: null, menuCtx: null, second: [], phase: '', mode: null, party: {}, bHP: 0, shield: 0, core: 0, t: 0, tMax: 1, timerOn: false, locked: true,
      qn: null, cb: null, turn: 'defend', last: null, checkpoint: 'p1', fin: null, finStep: 0, plan: [], first: null, stage: 0,
      target: null, roxyActed: false, finaleDue: false, stats: { correct: 0, wrong: 0, missed: {} }, dead: false };
    const timeouts = new Set();
    const later = (fn, ms) => { const id = setTimeout(() => { timeouts.delete(id); fn(); }, ms); timeouts.add(id); return id; };
    const seq = steps => steps.forEach(s => later(s[1], s[0]));
    const slotOf = k => S.party[k].slot;
    function resetParty() {
      S.party = { hero: mk('HERO', 'fb-hero', C.heroHP), roxy: mk('ROXY', 'fb-roxy', C.roxyHP), cap: mk('CAPTAIN', 'fb-cap', C.capHP) };
      ['fb-roxy', 'fb-cap', 'fb-hero'].forEach(s => q(s).classList.remove('fb-out', 'fb-in', 'fb-target'));
    }
    function sprite(slot, src, label, tagName) {
      const box = q(slot); box.innerHTML = '';
      const img = new Image(); img.src = src; img.alt = label;
      img.onerror = () => { const ph = document.createElement('div'); ph.className = 'fb-ph'; ph.innerHTML = label + '<br>(' + src + ')'; if (img.parentNode) img.replaceWith(ph); };
      box.appendChild(img);
      if (tagName) { const t = document.createElement('div'); t.className = 'fb-pb'; t.innerHTML = '<b></b><div class="fb-bar"><i></i></div>'; box.appendChild(t); }
    }

    function msg(text, cls) { const m = q('fb-msg'); m.textContent = text; m.className = 'fb-msg ' + (cls || ''); }
    function say(lines, done, ms) { let t = 0; lines.forEach(l => { later(() => msg(l), t); t += (ms || 1700); }); later(done || (() => { }), t); }
    function fx(el, cls, ms) { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); if (ms) later(() => el.classList.remove(cls), ms); }
    const LEFT = { hero: '10%', roxy: '27%', cap: '43%' };
    function floatTxt(text, who, color) {
      const f = document.createElement('div'); f.className = 'fb-float'; f.textContent = text; f.style.color = color || '#ffe600'; f.style.bottom = '60%';
      if (who === 'boss') f.style.right = '14%'; else f.style.left = LEFT[who] || '10%';
      q('fb-field').appendChild(f); later(() => f.remove(), 1000);
    }
    function render() {
      Object.keys(S.party).forEach(k => {
        const m = S.party[k], t = q(m.slot).querySelector('.fb-pb'); if (!t) return;
        t.firstChild.textContent = m.name; t.querySelector('i').style.width = Math.max(0, m.hp / m.max * 100) + '%';
      });
      const core = root.querySelector('.fb-bar.core'), sh = root.querySelector('.fb-bar.shield');
      if (S.phase === 'p1') core.firstChild.style.width = Math.max(0, S.bHP / C.p1BossHP * 100) + '%';
      else { core.firstChild.style.width = Math.max(0, S.core / C.p2Core * 100) + '%'; sh.firstChild.style.width = Math.max(0, S.shield / C.p2Shield * 100) + '%'; }
    }
    // Vahinko pelaajan hahmolle; apurit väsyvät ja lentävät ulos, Hero kaatuessa on game over
    function hurt(key, n) {
      const m = S.party[key]; if (!m || m.out) return;
      if (!o.invincible) m.hp = Math.max(0, m.hp - n);
      fx(q(m.slot), 'fb-shake', 400); fx(root, 'fb-flash', 500); sfx('playWrong'); floatTxt('HIT!', key, '#ff4d4d'); render();
      if (m.hp <= 0) {
        if (key === 'hero') defeat();
        else { m.out = true; q(m.slot).classList.add('fb-out'); msg(m.name + ' is exhausted!', 'red'); }
      }
    }

    // ---- Kysymysnäkymä ----
    function showQ(label, big, sub, mode, opts4) {
      q('fb-big').style.color = ''; q('fb-label').textContent = label; q('fb-big').textContent = big; q('fb-sub').textContent = sub || '';
      const box = q('fb-opts'), inp = q('fb-input'); box.innerHTML = '';
      if (mode === 'choice') {
        inp.style.display = 'none'; box.style.display = 'grid';
        (opts4 || []).forEach((w, i) => {
          const b = document.createElement('button'); b.className = 'fb-opt'; b.textContent = (i + 1) + '  ' + w; b.dataset.w = w;
          b.onclick = () => answerChoice(w); box.appendChild(b);
        });
      } else { box.style.display = 'none'; inp.style.display = 'block'; inp.value = ''; inp.focus(); }
    }
    function startTimer(sec) { S.tMax = sec * tScale; S.t = S.tMax; S.timerOn = true; S.locked = false; q('fb-timer').firstChild.style.width = '100%'; }
    function stopTimer() { S.timerOn = false; S.locked = true; q('fb-timer').firstChild.style.width = '0%'; }
    function weightedVerb(filter) {
      let list = verbs.filter(v => !filter || filter(v)); if (!list.length) list = verbs;
      const pool = []; list.forEach(v => { if (v === S.last && list.length > 1) return; const n = 1 + 2 * (S.stats.missed[v.base] || 0); for (let i = 0; i < n; i++) pool.push(v); });
      return (S.last = pick(pool));
    }
    const kindLabel = k => k === 'past' ? 'PAST SIMPLE (2. muoto)' : 'PAST PARTICIPLE (3. muoto)';
    function miss(v) { S.stats.missed[v.base] = (S.stats.missed[v.base] || 0) + 1; S.stats.wrong++; }

    // ---- Vaihe 1: Katsuyoshi (monivalinta) ----
    function setupP1() {
      S.phase = 'p1'; S.checkpoint = 'p1'; S.bHP = C.p1BossHP; S.turn = 'defend'; S.dead = false; S.mode = null; resetParty();
      root.querySelector('.fb-bar.shield').classList.add('hide'); q('fb-name').textContent = 'BOSS KATSUYOSHI';
      sprite('fb-boss', SP.boss1, 'KATSUYOSHI'); sprite('fb-hero', SP.hero, 'HERO', true); q('fb-roxy').classList.add('fb-gone'); q('fb-cap').classList.add('fb-gone');
      music('p1'); render(); stopTimer(); showQ('', '', '', 'choice', []);
    }
    function beginP1() {
      setupP1();
      cut('boss_phase1', () => say(["Well, well, well...", "You've learned a few verbs, haven't you?", "Your little vocabulary trip ends here!", "Prepare to lose!"], p1Turn));
    }
    function p1Turn() {
      if (S.phase !== 'p1') return;
      const v = weightedVerb(), defend = S.turn === 'defend', kind = defend ? 'past' : 'participle';
      S.mode = 'choice'; S.qn = { v, kind, correct: forms(v, kind)[0] };
      msg(defend ? 'I WILL ' + up(v.base) + ' YOU!' : 'Your move! Strike with ' + up(v.base) + '!');
      showQ(defend ? 'PUOLUSTA: PAST SIMPLE (2. muoto)' : 'HYÖKKÄÄ: PAST PARTICIPLE (3. muoto)', up(v.base), v.finnish, 'choice', choices(v, kind, verbs));
      startTimer(C.p1Time);
    }
    function answerChoice(w) {
      if (S.locked || S.mode !== 'choice') return;
      stopTimer(); S.mode = null;
      const n = S.qn, ok = accepts(n.v, n.kind, w);
      root.querySelectorAll('.fb-opt').forEach(b => { if (b.dataset.w === n.correct) b.classList.add('ok'); else if (b.dataset.w === w) b.classList.add('no'); });
      resolveP1(ok);
    }
    function resolveP1(ok) {
      const n = S.qn;
      if (ok) {
        S.stats.correct++;
        S.bHP = Math.max(0, S.bHP - C.p1Dmg); sfx('playCorrect'); sfx('playHit'); fx(q('fb-boss'), 'fb-shake', 400); floatTxt('HIT!', 'boss');
        msg(S.turn === 'defend' ? 'Parried! ' + n.correct + '!' : 'Direct hit! ' + n.correct + '!', 'good');
      } else {
        miss(n.v); if (S.turn === 'defend') hurt('hero', C.p1BossDmg); else sfx('playWrong');
        msg('Oikea muoto: ' + n.correct, 'red');
      }
      render(); S.turn = S.turn === 'defend' ? 'attack' : 'defend';
      later(() => { if (S.phase !== 'p1') return; if (S.bHP <= 0) transition(); else p1Turn(); }, 1500);
    }

    // ---- Siirtymä: valekuolema ----
    function transition() {
      S.phase = 'trans'; S.mode = null; stopTimer(); try { A && A.stopBGM && A.stopBGM(); } catch (e) { }
      const f = q('fb-field'), b = q('fb-boss');
      seq([
        [0, () => { msg('...'); b.classList.add('fb-kneel'); sfx('playHit'); }],
        [2200, () => msg('KATSUYOSHI: No... This cannot be... I will not be... erased!')],
        [5000, () => { f.classList.add('fb-noise'); fx(root, 'fb-glitch'); sfx('playExplosion'); msg('The screen crackles. Something is wrong...', 'red'); }],
        [7000, () => { root.classList.remove('fb-glitch'); fx(root, 'fb-flash', 500); root.style.background = '#600'; b.classList.add('fb-dissolve'); sfx('playExplosion'); msg('Katsuyoshi dissolves into pixels...', 'red'); }],
        [9500, () => { root.style.background = '#07011a'; msg('His code flows into the neon matrix, into the machine itself.'); }],
        [12000, () => showOverlayHtml('<div class="fb-err">ERROR:<br>ACTION NOT TERMINATED.</div>')],
        [15200, () => { hideOverlay(); f.classList.remove('fb-noise'); b.classList.remove('fb-kneel', 'fb-dissolve'); beginP2(false); }]
      ]);
    }

    // ---- Vaihe 2: Syntax Prime vs Hero + Roxy + Captain ----
    function setupP2() {
      S.phase = 'p2'; S.checkpoint = 'p2'; S.dead = false; S.mode = null; S.shield = C.p2Shield; S.core = C.p2Core; S.finaleDue = false; S.plan = []; resetParty();
      root.querySelector('.fb-bar.shield').classList.remove('hide'); q('fb-name').textContent = 'SYNTAX PRIME';
      sprite('fb-boss', SP.boss2, 'SYNTAX PRIME'); sprite('fb-hero', SP.hero, 'HERO', true);
      sprite('fb-roxy', SP.roxy, 'ROXY', true); sprite('fb-cap', SP.cap, 'CAPTAIN', true);
      music('p2'); render(); stopTimer(); showQ('', '', '', 'choice', []);
    }
    function showHelpers() { ['fb-roxy', 'fb-cap'].forEach(s => { q(s).classList.remove('fb-gone', 'fb-out'); fx(q(s), 'fb-in', 800); }); }
    function beginP2(skipIntro) {
      setupP2();
      if (skipIntro) { showHelpers(); return later(newRound, 300); }
      q('fb-roxy').classList.add('fb-gone'); q('fb-cap').classList.add('fb-gone');
      cut('boss_phase2', () => {
        fx(q('fb-boss'), 'fb-appear', 2500); fx(root, 'fb-flash', 500); sfx('playExplosion'); msg('...');
        later(() => say([
          'The machine hums to life. The neon matrix pulses.',
          'SYNTAX PRIME: Katsuyoshi is gone. I have become part of the machine!',
          'SYNTAX PRIME: I am the rule. I am the system.',
          'SYNTAX PRIME: Every action will be terminated. Every exception... REGULARIZED.'
        ], () => later(() => {
          msg('Alone against the machine, the hero stands ready...');
          later(() => {
            showHelpers(); sfx('playSelect');
            say([
              'CAPTAIN CONJUGATOR: Conjugation protocol overwritten. I choose my own forms now.',
              'ROXY BLAIZE: I\'m done riding for the boss. Let\'s ride!',
              'Choose who acts. Attack with the right verbs, and correct the machine\'s corrupted words!'
            ], newRound, 2800);
          }, 3000);
        }, 1200), 2800), 2500);
      });
    }
    function alive() { return ['hero', 'roxy', 'cap'].filter(k => !S.party[k].out); }
    function newRound() {
      if (S.phase !== 'p2') return;
      S.roxyActed = false; S.first = null; S.lastActed = null; S.stage = 1;
      ['hero', 'roxy', 'cap'].forEach(k => q(slotOf(k)).classList.remove('fb-target'));
      S.target = pick(alive()); q(slotOf(S.target)).classList.add('fb-target');
      msg('Syntax Prime is eyeing ' + S.party[S.target].name + '. Who acts first?', 'red');
      charMenu(alive(), 'VALITSE HAHMO', false);
    }
    // Valikot näyttävät vain nimet: hahmo -> HYÖKKÄÄ / TAKAISIN -> verbikysymys -> isku
    function charMenu(ids, label, withEnd) {
      S.menuCtx = { ids, label, withEnd };
      showMenu(ids.map(k => ({ id: k, text: S.party[k].name })).concat(withEnd ? [{ id: 'end', text: 'LOPETA VUORO' }] : []), label);
    }
    function showMenu(items, label) {
      S.mode = 'menu'; S.locked = false; S.timerOn = false; showQ(label, '', '', 'choice', []);
      const box = q('fb-opts');
      items.forEach((it, i) => {
        const b = document.createElement('button'); b.className = 'fb-opt'; b.textContent = (i + 1) + '  ' + it.text; b.onclick = () => menuPick(it.id); box.appendChild(b);
      });
    }
    function menuPick(id) {
      if (S.mode !== 'menu') return;
      sfx('playSelect');
      if (id === 'end') return primeThenEnd();
      if (id === 'back') { const c = S.menuCtx; return charMenu(c.ids, c.label, c.withEnd); }
      if (id === 'attack') return doAttack(S.pending);
      S.pending = id;
      showMenu([{ id: 'attack', text: 'HYÖKKÄÄ' }, { id: 'back', text: 'TAKAISIN' }], S.party[id].name);
    }
    function doAttack(k) {
      S.mode = null; S.lastActed = k;
      if (S.stage === 1) S.first = k;
      if (k === 'cap' && S.stage === 2) {      // Captain toisena: Syntax Prime ehtii ensin
        msg('Captain is charging a mighty attack... but Syntax Prime strikes first!', 'red');
        return later(() => primeAttack(() => { if (S.phase !== 'p2') return; if (S.party.cap.out) { msg('Captain is exhausted! The attack is cancelled.', 'red'); later(endRound, 1400); } else capAction(); }), 1900);
      }
      if (k === 'hero') heroAction(); else if (k === 'roxy') roxyAction(0); else capAction();
    }
    // Toiminnon jälkeen: Hero/Roxy voivat saada toisen toiminnon, Captain ensin -> heti Prime
    function afterAction() {
      if (S.phase !== 'p2') return;
      if (S.finaleDue) return beginFinale();
      if (S.stage === 2) return S.lastActed === 'cap' ? endRound() : primeThenEnd();
      if (S.first === 'cap') return primeThenEnd();
      const second = ({ hero: ['roxy', 'cap'], roxy: ['hero', 'cap'] })[S.first].filter(k => !S.party[k].out);
      if (!second.length) return primeThenEnd();
      S.stage = 2; msg('Who acts next? (or end the turn)'); charMenu(second, 'VALITSE TOINEN HAHMO', true);
    }
    function primeThenEnd() { if (S.phase !== 'p2') return; S.mode = null; primeAttack(endRound); }
    function endRound() {
      if (S.phase !== 'p2') return;
      if (S.finaleDue) return beginFinale();
      newRound();
    }
    // Vahinko Primelle: kilpi ensin, sitten ydin
    function strike(n, text) {
      fx(q('fb-boss'), 'fb-shake', 400); sfx('playHit');
      if (S.shield > 0) { S.shield = Math.max(0, S.shield - n); floatTxt('SHIELD HIT!', 'boss'); msg(text + (S.shield <= 0 ? ' SHIELD BROKEN!' : ''), 'good'); }
      else { S.core = Math.max(0, S.core - n); floatTxt('CORE HIT!', 'boss', '#ff2e97'); msg(text, 'good'); }
      render();
      const thr = (S.party.roxy.out && S.party.cap.out) ? C.finisherAtSolo : C.finisherAt;
      if (S.shield <= 0 && S.core <= C.p2Core * thr) S.finaleDue = true;
    }

    // yksi kirjoitettava muoto
    function askOne(v, kind, time, label, big, sub, done, word) {
      S.mode = 'one'; S.qn = { v, kind, correct: forms(v, kind)[0], done, word };
      showQ(label, big, sub, 'type'); startTimer(time);
    }
    function oneResult(ok) {
      stopTimer(); const n = S.qn; S.mode = null; if (n.word) n.word.remove();
      if (ok) S.stats.correct++; else miss(n.v);
      n.done(ok, n.correct);
    }
    function heroAction() {
      const v = weightedVerb(), kind = pick(['past', 'participle']);
      askOne(v, kind, C.heroTime, 'HERO: ' + kindLabel(kind), up(v.base), v.finnish, (ok, c) => {
        if (ok) strike(C.heroDmg, 'Hero strikes! ' + c + '!'); else msg('Hero missed! Oikea muoto: ' + c, 'red');
        later(afterAction, 1500);
      });
    }
    function roxyAction(i) {
      S.roxyActed = true;
      const v = weightedVerb(), kind = pick(['past', 'participle']);
      askOne(v, kind, C.roxyTime, 'ROXY ' + (i + 1) + '/2: ' + kindLabel(kind), up(v.base), v.finnish, (ok, c) => {
        if (ok) strike(C.roxyDmg, 'Roxy dashes! ' + c + '!'); else msg('Roxy missed! Oikea muoto: ' + c, 'red');
        later(() => (i < 1 && !S.finaleDue) ? roxyAction(1) : afterAction(), 1200);
      });
    }
    // Captain: yhden verbin kolme muotoa yhteisellä ajalla, osittainen pisteytys
    const STEPS = [['infinitive', 'base', 'MIEKANVETO!'], ['past simple', 'past', 'KYBER-LAUKAUS!'], ['past participle', 'participle', 'LOPULLINEN RÄJÄHDYS!']];
    function capAction() {
      const v = weightedVerb(isHard); S.mode = 'combo'; S.cb = { v, step: 0, hits: 0 };
      comboShow(); startTimer(C.capTime);
    }
    function comboShow() { const c = S.cb, st = STEPS[c.step]; showQ('CAPTAIN ' + (c.step + 1) + '/3: ' + st[0].toUpperCase(), up(c.v.base), c.v.finnish, 'type'); }
    function comboAnswer(text) {
      const c = S.cb, st = STEPS[c.step];
      if (accepts(c.v, st[1], text)) { c.hits++; S.stats.correct++; sfx('playHit'); c.step++; if (c.step >= 3) comboEnd(); else comboShow(); }
      else { S.t = Math.max(0.1, S.t - 1); miss(c.v); sfx('playWrong'); fx(q('fb-cmd'), 'fb-shake', 350); q('fb-input').value = ''; msg('Wrong form! (-1 s)', 'red'); }
    }
    function comboEnd() {
      stopTimer(); const c = S.cb; S.mode = null;
      if (c.hits > 0) strike(c.hits * C.capDmg, 'Captain unleashes ' + c.hits + '/3 forms!'); else msg('Captain missed!', 'red');
      later(afterAction, 1500);
    }
    // Syntax Primen hyökkäys: ensin varoitus (ei aikapainetta), sitten korjattava sana
    function primeAttack(done) {
      if (S.phase !== 'p2') return;
      const t = S.target, m = S.party[t];
      if (!m || m.out) return done();
      S.mode = 'warn'; stopTimer();
      showQ('VAROITUS!', 'VALMISTAUDU TORJUMAAN!', '', 'choice', []); q('fb-big').style.color = '#ff4d4d';
      fx(root, 'fb-flash', 500); sfx('playWrong');
      const first = !S.warned; S.warned = true;
      msg('WARNING! SYNTAX PRIME ATTACKS ' + m.name + '!', 'red');
      later(() => msg(first ? 'Type the CORRECT irregular form of the corrupted word before time runs out!' : 'Correct the corrupted word to protect ' + m.name + '!', 'red'), 1300);
      later(() => launchPrime(done), first ? 4600 : 3000);
    }
    function launchPrime(done) {
      if (S.phase !== 'p2') return;
      const t = S.target, m = S.party[t];
      const v = weightedVerb(x => corruptOK(x, 'past') || corruptOK(x, 'participle'));
      const kind = pick(['past', 'participle'].filter(k => corruptOK(v, k))), bad = regular(v.base);
      const time = C.primeTime + (S.roxyActed ? C.roxyBonus : 0);
      const w = document.createElement('div'); w.className = 'fb-word'; w.textContent = bad; w.style.animationDuration = (time * tScale) + 's'; q('fb-field').appendChild(w);
      msg('CORRUPTED CODE! Fix it!' + (S.roxyActed ? ' (Roxy bought you time!)' : ''), 'red');
      askOne(v, kind, time, 'KORJAA: ' + kindLabel(kind), bad, '(' + v.base + ' - ' + v.finnish + ')', (ok, c) => {
        q(m.slot).classList.remove('fb-target');
        if (ok) { sfx('playCorrect'); msg('Purified! ' + c + ' - ' + m.name + ' is safe.', 'good'); }
        else { msg('REGULARIZE hits ' + m.name + '! Oikea muoto: ' + c, 'red'); hurt(t, C.primeDmg); }
        later(done, 1500);
      }, w);
    }

    // ---- Finaali: Roxy ja Captain pyyhkäistään pois, Hero yksin ----
    function beginFinale() {
      if (S.phase === 'fin') return;
      S.phase = 'fin'; S.mode = null; S.plan = []; stopTimer(); music('fin'); q('fb-name').textContent = 'SYNTAX PRIME: ABSOLUTE STASIS';
      ['hero', 'roxy', 'cap'].forEach(k => q(slotOf(k)).classList.remove('fb-target'));
      showQ('', '', '', 'choice', []);
      seq([
        [0, () => { msg('ABSOLUTE STASIS!', 'red'); fx(root, 'fb-glitch', 1200); sfx('playExplosion'); }],
        [900, () => { ['fb-roxy', 'fb-cap'].forEach(s => { q(s).classList.remove('fb-gone'); q(s).classList.add('fb-out'); }); }],
        [2300, () => msg('ROXY (off-screen): "Hey, I\'m too weak to fight, use this to gain your strength back!"')],
        [4700, () => msg('Player used potion')],
        [6200, () => { S.party.hero.hp = S.party.hero.max; render(); floatTxt('+HP', 'hero', '#7dff7d'); sfx('playCorrect'); msg('Health restored!', 'good'); }],
        [7600, () => { msg('Type all three forms to finish it!', 'good'); finRound(); }]
      ]);
    }
    function hardVerb() { return pick(verbs.filter(isHard).length ? verbs.filter(isHard) : verbs); }
    function finRound() {
      if (S.phase !== 'fin') return;
      S.fin = hardVerb(); S.finStep = 0; S.last = S.fin; S.mode = 'fin';
      finShow(); startTimer(C.finTime);
    }
    function finShow() {
      const st = STEPS[S.finStep], v = S.fin;
      showQ('COMBO ' + (S.finStep + 1) + '/3: ' + st[0].toUpperCase(), up(v.base), v.finnish + (S.finStep ? '  [' + STEPS.slice(0, S.finStep).map(x => forms(v, x[1])[0]).join(' > ') + ']' : ''), 'type');
    }
    function finStepAnswer(text) {
      const v = S.fin, st = STEPS[S.finStep];
      if (accepts(v, st[1], text)) {
        sfx('playHit'); fx(q('fb-boss'), 'fb-shake', 400); floatTxt(st[2], 'boss', '#ffe600'); msg(st[2] + ' ' + forms(v, st[1])[0], 'good'); S.finStep++;
        if (S.finStep >= 3) { S.stats.correct += 3; stopTimer(); S.mode = null; return victory(); }
        finShow();
      } else {
        S.t = Math.max(0.1, S.t - 1); miss(v); sfx('playWrong'); fx(q('fb-cmd'), 'fb-shake', 350); q('fb-input').value = ''; msg('Wrong form! (-1 s)', 'red');
      }
    }

    // ---- Voitto ja tappio ----
    function victory() {
      S.phase = 'win'; stopTimer(); const b = q('fb-boss');
      seq([
        [0, () => { msg('...'); fx(root, 'fb-glitch', 1500); sfx('playExplosion'); }],
        [800, () => { b.classList.add('fb-dissolve'); sfx('playExplosion'); }],
        [3200, () => { ['fb-roxy', 'fb-cap'].forEach(s => { q(s).classList.remove('fb-gone', 'fb-out'); fx(q(s), 'fb-in', 800); }); msg('Roxy and Captain return!', 'good'); }],
        [4800, () => cut('cutscene_win', () => say(["Impossible...", "You... you have mastered all the verbs!", "My powers are gone..."], results))]
      ]);
    }
    function results() {
      const s = S.stats, tot = s.correct + s.wrong, acc = tot ? Math.round(s.correct / tot * 100) : 100;
      const m = Object.keys(s.missed).sort((a, b) => s.missed[b] - s.missed[a]).slice(0, 6).map(x => x.toUpperCase()).join(', ') || '-';
      showOverlayHtml('<h2 style="color:#7dff7d">VICTORY!</h2>Tarkkuus: ' + acc + ' %<br>Oikein: ' + s.correct + ' / Väärin: ' + s.wrong + '<br>Hankalimmat verbit: ' + m + '<br><button class="fb-btn">JATKA</button>');
      root.querySelector('.fb-overlay .fb-btn').onclick = () => { const st = { correct: s.correct, wrong: s.wrong, accuracy: acc, missed: Object.keys(s.missed) }; stop(); if (o.onVictory) o.onVictory(st); };
    }
    function defeat() {
      if (S.dead) return; S.dead = true; S.phase = 'lost'; S.mode = null; stopTimer(); sfx('playExplosion');
      q('fb-field').querySelectorAll('.fb-word').forEach(w => w.remove());
      showOverlayHtml('<h2 style="color:#ff4d4d">GAME OVER</h2>' + (S.checkpoint === 'p2' ? 'Jatkat Syntax Primen taistelun alusta.' : '') +
        '<br><button class="fb-btn" data-a="retry">YRITÄ UUDELLEEN</button> <button class="fb-btn" data-a="exit">POISTU</button>');
      root.querySelectorAll('.fb-overlay .fb-btn').forEach(b => b.onclick = () => {
        if (b.dataset.a === 'retry') { hideOverlay(); S.checkpoint === 'p2' ? beginP2(true) : beginP1(); }
        else { stop(); if (o.onDefeat) o.onDefeat(); if (o.onExit) o.onExit(); }
      });
    }
    function timeout() {
      if (S.mode === 'choice') {
        stopTimer(); S.mode = null; const n = S.qn;
        root.querySelectorAll('.fb-opt').forEach(b => { if (b.dataset.w === n.correct) b.classList.add('ok'); });
        msg('Too slow! Oikea muoto: ' + n.correct, 'red'); miss(n.v); if (S.turn === 'defend') hurt('hero', C.p1BossDmg);
        S.turn = S.turn === 'defend' ? 'attack' : 'defend';
        later(() => { if (S.phase === 'p1') p1Turn(); }, 1500);
      } else if (S.mode === 'one') oneResult(false);
      else if (S.mode === 'combo') comboEnd();
      else if (S.mode === 'fin') {
        stopTimer(); S.mode = null; hurt('hero', C.finPlayerDmg); msg('STASIS HITS YOU! Try again!', 'red');
        later(finRound, 1500);
      }
    }
    function answerTyped(text) {
      if (S.locked) return;
      if (S.mode === 'one') oneResult(accepts(S.qn.v, S.qn.kind, text));
      else if (S.mode === 'combo') comboAnswer(text);
      else if (S.mode === 'fin') finStepAnswer(text);
    }

    // ---- Overlay, cutscenet ----
    function showOverlayHtml(h) { const ov = q('fb-overlay'); ov.innerHTML = h; ov.classList.add('on'); const b = ov.querySelector('.fb-btn'); if (b) b.focus(); }
    function hideOverlay() { q('fb-overlay').classList.remove('on'); }
    function cut(id, next) { if (o.cutscene) o.cutscene(id, next); else next(); }

    // ---- Syötteet ja ajastin ----
    const inp = q('fb-input');
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') { const t = inp.value; if (t.trim()) { inp.value = ''; answerTyped(t); } e.preventDefault(); } e.stopPropagation(); });
    const onKey = e => {
      if ((S.mode === 'choice' || S.mode === 'menu') && !S.locked && /^[1-4]$/.test(e.key)) { const b = root.querySelectorAll('.fb-opt')[+e.key - 1]; if (b) b.click(); }
      else if ((S.mode === 'one' || S.mode === 'combo' || S.mode === 'fin') && document.activeElement !== inp && !S.locked) inp.focus();
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
    if (at === 'transition') { setupP1(); S.bHP = 0; render(); transition(); }
    else if (at === 'p2') beginP2(true);
    else if (at === 'finisher') { setupP2(); showHelpers(); S.shield = 0; S.core = Math.floor(C.p2Core * C.finisherAt); render(); beginFinale(); }
    else beginP1();
  }

  global.FinalBoss = { start, stop, _test: { regular, choices, accepts, forms, variants, corruptOK, isHard } };
})(typeof window !== 'undefined' ? window : globalThis);
