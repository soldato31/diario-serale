/* Calcolatrice Serale — modulo condiviso tra Diario Serale e Portale Scuola.
   Uso: Calc.mount(elemento, {topics: () => ['equazioni lineari', ...]})
   Virgola = decimale, punto e virgola = separatore degli argomenti: root(3;27), log(2;8). */
(function () {
  'use strict';
  const LSK = 'calc_v1';
  const load = () => { try { return Object.assign({ hist: [], vars: {}, stats: {}, mode: 'deg', tab: 'calc' }, JSON.parse(localStorage.getItem(LSK)) || {}); } catch (e) { return { hist: [], vars: {}, stats: {}, mode: 'deg', tab: 'calc' }; } };
  let S = load();
  const save = () => { try { localStorage.setItem(LSK, JSON.stringify(S)); } catch (e) {} };
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

  /* ================= NUMERI E FRAZIONI ================= */
  const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a; };
  const lcm = (a, b) => Math.abs(a * b) / gcd(a, b);
  function toFrac(x, maxD = 10000) {
    if (!isFinite(x)) return null; if (Number.isInteger(x)) return [x, 1];
    let h1 = 1, h0 = 0, k1 = 0, k0 = 1, b = x;
    for (let i = 0; i < 40; i++) { const a = Math.floor(b); [h1, h0] = [a * h1 + h0, h1]; [k1, k0] = [a * k1 + k0, k1]; if (k1 > maxD) return null; if (Math.abs(x - h1 / k1) < 1e-10 * Math.max(1, Math.abs(x))) return [h1, k1]; b = 1 / (b - a); if (!isFinite(b)) break; }
    return null;
  }
  const fmtNum = (x, dig = 10) => {
    if (typeof x !== 'number') return String(x); if (isNaN(x)) return 'non definito'; if (!isFinite(x)) return x > 0 ? '∞' : '−∞';
    if (x !== 0 && (Math.abs(x) >= 1e10 || Math.abs(x) < 1e-6)) { const [m, e] = x.toExponential(6).split('e'); return (+m).toString().replace('.', ',') + ' · 10^' + (+e); }
    return (+x.toPrecision(dig)).toString().replace('.', ',').replace('-', '−');
  };
  const fmtFrac = x => { const f = toFrac(x); if (!f || f[1] === 1) return fmtNum(x); return (f[0] < 0 ? '−' : '') + Math.abs(f[0]) + '/' + f[1]; };
  const fmtBoth = x => { const f = toFrac(x); return f && f[1] !== 1 && f[1] <= 1000 ? fmtFrac(x) + '  ≈ ' + fmtNum(x) : fmtNum(x); };

  /* ================= PARSER (niente eval) ================= */
  const CONST = { pi: Math.PI, 'π': Math.PI, e: Math.E, g: 9.81, c: 299792458, NA: 6.022e23, R: 8.314, G: 6.674e-11, h: 6.626e-34, qe: 1.602e-19 };
  const fact = n => { if (n < 0 || !Number.isInteger(n)) return NaN; let r = 1; for (let i = 2; i <= n; i++) r *= i; return r; };
  function FUN(mode) {
    const toR = x => mode === 'deg' ? x * Math.PI / 180 : x, frR = x => mode === 'deg' ? x * 180 / Math.PI : x;
    const fix = v => Math.abs(v) < 1e-12 ? 0 : v;
    return {
      sin: x => fix(Math.sin(toR(x))), cos: x => fix(Math.cos(toR(x))), tan: x => { const c = Math.cos(toR(x)); return Math.abs(c) < 1e-12 ? NaN : fix(Math.tan(toR(x))); },
      asin: x => frR(Math.asin(x)), acos: x => frR(Math.acos(x)), atan: x => frR(Math.atan(x)),
      sinh: Math.sinh, cosh: Math.cosh, tanh: Math.tanh,
      sqrt: Math.sqrt, rad: Math.sqrt, cbrt: Math.cbrt, root: (n, x) => x < 0 && n % 2 ? -Math.pow(-x, 1 / n) : Math.pow(x, 1 / n),
      ln: Math.log, log: (a, b) => b === undefined ? Math.log10(a) : Math.log(b) / Math.log(a), exp: Math.exp, abs: Math.abs,
      round: (x, n = 0) => Math.round(x * 10 ** n) / 10 ** n, floor: Math.floor, ceil: Math.ceil, fact,
      nCr: (n, k) => fact(n) / (fact(k) * fact(n - k)), nPr: (n, k) => fact(n) / fact(n - k),
      mcd: (...a) => a.reduce(gcd), MCD: (...a) => a.reduce(gcd), mcm: (...a) => a.reduce(lcm), mcm2: lcm,
      max: Math.max, min: Math.min, media: (...a) => a.reduce((s, x) => s + x, 0) / a.length,
    };
  }
  function tokenize(src) {
    const s = String(src).replace(/×|·/g, '*').replace(/÷|:/g, '/').replace(/−/g, '-').replace(/√\s*(\d+(?:[.,]\d+)?|[a-zA-Zπ]\w*)/g, 'sqrt($1)').replace(/√/g, 'sqrt').replace(/²/g, '^2').replace(/³/g, '^3').replace(/\*\*/g, '^');
    const T = []; let i = 0;
    while (i < s.length) {
      const ch = s[i];
      if (/\s/.test(ch)) { i++; continue; }
      if (/[0-9]/.test(ch) || (ch === '.' && /[0-9]/.test(s[i + 1]))) {
        let j = i; while (j < s.length && /[0-9]/.test(s[j])) j++;
        if ((s[j] === ',' || s[j] === '.') && /[0-9]/.test(s[j + 1] || '')) { j++; while (j < s.length && /[0-9]/.test(s[j])) j++; }
        let num = s.slice(i, j).replace(',', '.');
        if (/[eE]/.test(s[j] || '') && /[-+0-9]/.test(s[j + 1] || '') && !/[a-zA-Z]/.test(s[j + 1])) { let k = j + 1; if (/[-+]/.test(s[k])) k++; if (/[0-9]/.test(s[k])) { while (/[0-9]/.test(s[k] || '')) k++; num += s.slice(j, k); j = k; } }
        T.push({ t: 'n', v: parseFloat(num) }); i = j; continue;
      }
      if (/[a-zA-Zπ_]/.test(ch)) { let j = i; while (j < s.length && /[a-zA-Z0-9π_]/.test(s[j])) j++; T.push({ t: 'id', v: s.slice(i, j) }); i = j; continue; }
      if ('+-*/^()!%;,='.includes(ch)) { T.push({ t: ch === ',' ? ';' : ch }); i++; continue; }
      throw new Error('carattere non valido: «' + ch + '»');
    }
    // moltiplicazione implicita: 2x, 2(3), )(, x(…) per variabili, 3π
    const out = [];
    T.forEach((t, k) => {
      const p = out[out.length - 1];
      const endsVal = p && (p.t === 'n' || p.t === ')' || p.t === '!' || p.t === '%' || (p.t === 'id' && !isFunc(p.v)));
      const startsVal = t.t === 'n' || t.t === '(' || t.t === 'id';
      if (endsVal && startsVal && !(p.t === 'id' && t.t === '(' && isFunc(p.v))) out.push({ t: '*' });
      out.push(t);
    });
    return out;
  }
  const FN_NAMES = new Set(Object.keys(FUN('deg')));
  const isFunc = n => FN_NAMES.has(n);
  // Parser a discesa ricorsiva
  function parse(src) {
    const T = tokenize(src); let p = 0;
    const peek = () => T[p], eat = t => { if (T[p] && T[p].t === t) return T[p++]; throw new Error(t === ')' ? 'manca una parentesi chiusa' : 'atteso «' + t + '»'); };
    function expr() { let n = term(); while (peek() && (peek().t === '+' || peek().t === '-')) { const o = T[p++].t; n = { o, a: n, b: term() }; } return n; }
    function term() { let n = unary(); while (peek() && (peek().t === '*' || peek().t === '/')) { const o = T[p++].t; n = { o, a: n, b: unary() }; } return n; }
    function unary() { if (peek() && peek().t === '-') { p++; return { o: 'neg', a: unary() }; } if (peek() && peek().t === '+') { p++; return unary(); } return power(); }
    function power() { const b = postfix(); if (peek() && peek().t === '^') { p++; return { o: '^', a: b, b: unary() }; } return b; }
    function postfix() { let n = atom(); while (peek() && (peek().t === '!' || peek().t === '%')) { const o = T[p++].t; n = { o, a: n }; } return n; }
    function atom() {
      const t = T[p++]; if (!t) throw new Error('espressione incompleta');
      if (t.t === 'n') return { o: 'n', v: t.v };
      if (t.t === '(') { const n = expr(); eat(')'); return n; }
      if (t.t === 'id') {
        if (isFunc(t.v) && peek() && peek().t === '(') { p++; const args = [expr()]; while (peek() && peek().t === ';') { p++; args.push(expr()); } eat(')'); return { o: 'f', f: t.v, args }; }
        return { o: 'v', v: t.v };
      }
      throw new Error('simbolo inatteso');
    }
    const n = expr(); if (p < T.length) throw new Error(T[p].t === ')' ? 'parentesi chiusa di troppo' : 'non capisco la parte finale'); return n;
  }
  function evalN(n, scope, F) {
    switch (n.o) {
      case 'n': return n.v;
      case 'v': if (n.v in scope) return scope[n.v]; if (n.v in CONST) return CONST[n.v]; throw new Error('non conosco «' + n.v + '»');
      case 'neg': return -evalN(n.a, scope, F);
      case '+': return evalN(n.a, scope, F) + evalN(n.b, scope, F);
      case '-': return evalN(n.a, scope, F) - evalN(n.b, scope, F);
      case '*': return evalN(n.a, scope, F) * evalN(n.b, scope, F);
      case '/': { const d = evalN(n.b, scope, F); return evalN(n.a, scope, F) / d; }
      case '^': { const a = evalN(n.a, scope, F), b = evalN(n.b, scope, F); if (a < 0 && !Number.isInteger(b)) { const f = toFrac(b, 99); if (f && f[1] % 2) return (f[0] % 2 ? -1 : 1) * Math.pow(-a, b); } return Math.pow(a, b); }
      case '!': return fact(evalN(n.a, scope, F));
      case '%': return evalN(n.a, scope, F) / 100;
      case 'f': return F[n.f](...n.args.map(a => evalN(a, scope, F)));
    }
  }
  function calc(src, scope = {}, mode = S.mode) { return evalN(parse(src), Object.assign({}, S.vars, scope), FUN(mode)); }
  const compile = src => { const n = parse(src); return (scope, mode = S.mode) => evalN(n, Object.assign({}, S.vars, scope), FUN(mode)); };

  /* ================= RISOLUTORE DI EQUAZIONI (con passaggi) ================= */
  function solveEq(src) {
    const steps = []; if (!src.includes('=')) src += '=0';
    const [L, R] = src.split('='); if (src.split('=').length !== 2) throw new Error('scrivi una sola uguaglianza');
    const fl = compile(L), fr = compile(R);
    const vars = new Set(); tokenize(src).forEach(t => { if (t.t === 'id' && !isFunc(t.v) && !(t.v in CONST) && !(t.v in S.vars)) vars.add(t.v); });
    const v = vars.has('x') ? 'x' : [...vars][0]; if (!v) throw new Error('manca l\'incognita (usa x)');
    if (vars.size > 1) throw new Error('più incognite: per due equazioni usa «Sistemi»');
    const f = x => fl({ [v]: x }) - fr({ [v]: x });
    // grado: linearità/quadraticità verificata su più punti
    const c = f(0), A1 = f(1), Am = f(-1), a2 = (A1 + Am - 2 * c) / 2, b = (A1 - Am) / 2;
    const fits = (deg) => [2, -3, 0.5, 7].every(x => { const y = deg === 1 ? b * x + c : a2 * x * x + b * x + c; return Math.abs(f(x) - y) < 1e-7 * (1 + Math.abs(y)); });
    steps.push('Porto tutto al primo membro:  (' + L.trim() + ') − (' + R.trim() + ') = 0');
    if (Math.abs(a2) < 1e-12 && fits(1)) {
      steps.push('Svolgo i calcoli e raccolgo ' + v + ':  ' + poly([0, b, c], v) + ' = 0');
      if (Math.abs(b) < 1e-12) { const r = Math.abs(c) < 1e-12 ? 'indeterminata: ogni numero è soluzione (0 = 0)' : 'impossibile: viene ' + fmtNum(c) + ' = 0, falso'; steps.push('Il coefficiente di ' + v + ' è zero → equazione ' + r); return { tipo: 'lineare', steps, sol: r }; }
      steps.push('Isolo ' + v + ':  ' + fmtFrac(b) + '·' + v + ' = ' + fmtFrac(-c));
      const x = -c / b; steps.push('Divido per ' + fmtFrac(b) + ':  ' + v + ' = ' + fmtFrac(-c) + ' / ' + fmtFrac(b) + ' = ' + fmtBoth(x));
      steps.push('Verifica: sostituisco ' + v + ' = ' + fmtFrac(x) + ' → primo membro ' + fmtBoth(fl({ [v]: x })) + ', secondo membro ' + fmtBoth(fr({ [v]: x })) + ' ✓');
      return { tipo: 'lineare (1° grado)', steps, sol: v + ' = ' + fmtBoth(x) };
    }
    if (fits(2)) {
      steps.push('È di 2° grado. Forma normale:  ' + poly([a2, b, c], v) + ' = 0   (a = ' + fmtFrac(a2) + ', b = ' + fmtFrac(b) + ', c = ' + fmtFrac(c) + ')');
      const D = b * b - 4 * a2 * c; steps.push('Δ = b² − 4ac = ' + fmtFrac(b * b) + ' − ' + fmtFrac(4 * a2 * c) + ' = ' + fmtFrac(D));
      if (D < -1e-12) { steps.push('Δ < 0 → nessuna soluzione reale'); return { tipo: '2° grado', steps, sol: 'nessuna soluzione reale' }; }
      if (Math.abs(D) < 1e-12) { const x = -b / (2 * a2); steps.push('Δ = 0 → due soluzioni coincidenti: x = −b/2a = ' + fmtBoth(x)); return { tipo: '2° grado', steps, sol: v + '₁ = ' + v + '₂ = ' + fmtBoth(x) }; }
      const x1 = (-b - Math.sqrt(D)) / (2 * a2), x2 = (-b + Math.sqrt(D)) / (2 * a2);
      steps.push(v + ' = (−b ± √Δ) / 2a = (' + fmtFrac(-b) + ' ± ' + fmtNum(Math.sqrt(D)) + ') / ' + fmtFrac(2 * a2));
      return { tipo: '2° grado', steps, sol: v + '₁ = ' + fmtBoth(x1) + '   ;   ' + v + '₂ = ' + fmtBoth(x2) };
    }
    // numerico
    const roots = []; let prev = f(-1000), px = -1000;
    for (let x = -1000; x <= 1000; x += 0.05) { const y = f(x); if (isFinite(y) && isFinite(prev) && prev * y <= 0) { let a = px, bb = x; for (let k = 0; k < 80; k++) { const m = (a + bb) / 2; (f(a) * f(m) <= 0) ? bb = m : a = m; } const r = (a + bb) / 2; if (Math.abs(f(r)) < 1e-6 && !roots.some(q => Math.abs(q - r) < 1e-6)) roots.push(r); } prev = y; px = x; }
    steps.push('Equazione non di 1° o 2° grado: cerco le soluzioni per via numerica tra −1000 e 1000.');
    return { tipo: 'numerica', steps, sol: roots.length ? roots.map(r => v + ' ≈ ' + fmtNum(r, 8)).join('   ;   ') : 'nessuna soluzione trovata nell\'intervallo' };
  }
  function poly(co, v) { const [a, b, c] = co; const parts = []; if (Math.abs(a) > 1e-12) parts.push(fmtFrac(a) + v + '²'); if (Math.abs(b) > 1e-12) parts.push(fmtFrac(b) + v); if (Math.abs(c) > 1e-12 || !parts.length) parts.push(fmtFrac(c)); return parts.join(' + ').replace(/\+ −/g, '− ').replace(/^1x/, 'x').replace(/ 1x/, ' x'); }
  function solveSys(e1, e2) {
    const co = s => { if (!s.includes('=')) s += '=0'; const [L, R] = s.split('='); const fl = compile(L), fr = compile(R); const f = (x, y) => fl({ x, y }) - fr({ x, y }); const c = f(0, 0); return [f(1, 0) - c, f(0, 1) - c, -c]; };
    const [a, b, c] = co(e1), [d, e, f] = co(e2), steps = [];
    steps.push('Forma normale:  ' + fmtFrac(a) + 'x + ' + fmtFrac(b) + 'y = ' + fmtFrac(c) + '   e   ' + fmtFrac(d) + 'x + ' + fmtFrac(e) + 'y = ' + fmtFrac(f));
    const D = a * e - b * d, Dx = c * e - b * f, Dy = a * f - c * d;
    steps.push('Metodo di Cramer:  D = ' + fmtFrac(a) + '·' + fmtFrac(e) + ' − ' + fmtFrac(b) + '·' + fmtFrac(d) + ' = ' + fmtFrac(D));
    if (Math.abs(D) < 1e-12) return { steps, sol: Math.abs(Dx) < 1e-12 && Math.abs(Dy) < 1e-12 ? 'indeterminato (infinite soluzioni)' : 'impossibile (nessuna soluzione)' };
    steps.push('Dx = ' + fmtFrac(Dx) + '   Dy = ' + fmtFrac(Dy)); steps.push('x = Dx/D = ' + fmtBoth(Dx / D) + '   ;   y = Dy/D = ' + fmtBoth(Dy / D));
    return { steps, sol: 'x = ' + fmtBoth(Dx / D) + '   ;   y = ' + fmtBoth(Dy / D) };
  }

  /* ================= FORMULARIO RISOLVIBILE ================= */
  // [materia, nome, formula "y = espressione", {variabile: [descrizione, unità]}]
  const FORM = [
    ['Matematica', 'Teorema di Pitagora', 'c = sqrt(a^2+b^2)', { c: ['ipotenusa', ''], a: ['cateto a', ''], b: ['cateto b', ''] }],
    ['Matematica', 'Area del cerchio', 'A = pi*r^2', { A: ['area', 'm²'], r: ['raggio', 'm'] }],
    ['Matematica', 'Percentuale', 'p = x*q/100', { p: ['parte', ''], x: ['totale', ''], q: ['percentuale', '%'] }],
    ['Matematica', 'Proporzione a:b = c:d', 'd = b*c/a', { d: ['quarto termine', ''], a: ['a', ''], b: ['b', ''], c: ['c', ''] }],
    ['Matematica', 'Volume del cilindro', 'V = pi*r^2*h', { V: ['volume', 'm³'], r: ['raggio', 'm'], h: ['altezza', 'm'] }],
    ['Fisica', 'Velocità media (MRU)', 'v = s/t', { v: ['velocità', 'm/s'], s: ['spazio', 'm'], t: ['tempo', 's'] }],
    ['Fisica', 'Accelerazione', 'a = (v - v0)/t', { a: ['accelerazione', 'm/s²'], v: ['velocità finale', 'm/s'], v0: ['velocità iniziale', 'm/s'], t: ['tempo', 's'] }],
    ['Fisica', 'Spazio nel moto accelerato', 's = v0*t + a*t^2/2', { s: ['spazio', 'm'], v0: ['velocità iniziale', 'm/s'], t: ['tempo', 's'], a: ['accelerazione', 'm/s²'] }],
    ['Fisica', '2ª legge di Newton', 'F = m*a', { F: ['forza', 'N'], m: ['massa', 'kg'], a: ['accelerazione', 'm/s²'] }],
    ['Fisica', 'Forza peso', 'P = m*9.81', { P: ['peso', 'N'], m: ['massa', 'kg'] }],
    ['Fisica', 'Densità', 'd = m/V', { d: ['densità', 'kg/m³'], m: ['massa', 'kg'], V: ['volume', 'm³'] }],
    ['Fisica', 'Pressione', 'p = F/S', { p: ['pressione', 'Pa'], F: ['forza', 'N'], S: ['superficie', 'm²'] }],
    ['Fisica', 'Pressione idrostatica (Stevino)', 'p = d*9.81*h', { p: ['pressione', 'Pa'], d: ['densità liquido', 'kg/m³'], h: ['profondità', 'm'] }],
    ['Fisica', 'Lavoro', 'L = F*s', { L: ['lavoro', 'J'], F: ['forza', 'N'], s: ['spostamento', 'm'] }],
    ['Fisica', 'Energia cinetica', 'E = m*v^2/2', { E: ['energia', 'J'], m: ['massa', 'kg'], v: ['velocità', 'm/s'] }],
    ['Fisica', 'Energia potenziale', 'E = m*9.81*h', { E: ['energia', 'J'], m: ['massa', 'kg'], h: ['altezza', 'm'] }],
    ['Fisica', 'Potenza', 'P = L/t', { P: ['potenza', 'W'], L: ['lavoro', 'J'], t: ['tempo', 's'] }],
    ['Fisica', 'Legge di Hooke', 'F = k*x', { F: ['forza', 'N'], k: ['costante elastica', 'N/m'], x: ['allungamento', 'm'] }],
    ['Fisica', 'Calore', 'Q = m*cs*dT', { Q: ['calore', 'J'], m: ['massa', 'kg'], cs: ['calore specifico', 'J/(kg·K)'], dT: ['ΔT', 'K'] }],
    ['Fisica', 'Legge di Ohm', 'V = R*I', { V: ['tensione', 'V'], R: ['resistenza', 'Ω'], I: ['corrente', 'A'] }],
    ['Fisica', 'Errore relativo', 'er = ea/x', { er: ['errore relativo', ''], ea: ['errore assoluto', ''], x: ['valore medio', ''] }],
    ['Chimica', 'Moli', 'n = m/M', { n: ['moli', 'mol'], m: ['massa', 'g'], M: ['massa molare', 'g/mol'] }],
    ['Chimica', 'Numero di particelle', 'N = n*6.022e23', { N: ['particelle', ''], n: ['moli', 'mol'] }],
    ['Chimica', 'Molarità', 'C = n/V', { C: ['molarità', 'mol/L'], n: ['moli', 'mol'], V: ['volume', 'L'] }],
    ['Chimica', 'Diluizione', 'C2 = C1*V1/V2', { C2: ['conc. finale', 'mol/L'], C1: ['conc. iniziale', 'mol/L'], V1: ['volume iniziale', 'L'], V2: ['volume finale', 'L'] }],
    ['Chimica', 'Gas perfetti', 'P = n*0.0821*T/V', { P: ['pressione', 'atm'], n: ['moli', 'mol'], T: ['temperatura', 'K'], V: ['volume', 'L'] }],
    ['Chimica', 'pH', 'pH = -log(H)', { pH: ['pH', ''], H: ['[H⁺]', 'mol/L'] }],
    ['Chimica', 'Neutroni', 'N = A - Z', { N: ['neutroni', ''], A: ['numero di massa', ''], Z: ['numero atomico', ''] }],
    ['Chimica', 'Percentuale in massa', 'p = ms/mt*100', { p: ['% m/m', '%'], ms: ['massa soluto', 'g'], mt: ['massa soluzione', 'g'] }],
    ['Meccanica', 'Velocità di taglio', 'Vt = pi*D*n/1000', { Vt: ['velocità di taglio', 'm/min'], D: ['diametro', 'mm'], n: ['giri', 'giri/min'] }],
    ['Meccanica', 'Momento torcente', 'Mt = 9550*P/n', { Mt: ['momento', 'N·m'], P: ['potenza', 'kW'], n: ['giri', 'giri/min'] }],
    ['Meccanica', 'Tensione normale', 's = N/A', { s: ['σ', 'N/mm²'], N: ['forza', 'N'], A: ['sezione', 'mm²'] }],
    ['Meccanica', 'Rapporto di trasmissione', 'i = z2/z1', { i: ['rapporto', ''], z2: ['denti condotta', ''], z1: ['denti motrice', ''] }],
  ];
  function solveFormula(fm, known, unk) {
    const [lhs, rhs] = fm[2].split('=').map(s => s.trim()); const fr = compile(rhs);
    const g = x => { const sc = Object.assign({}, known, { [unk]: x }); return (unk === lhs ? x : sc[lhs]) - fr(sc, 'rad'); };
    if (unk === lhs) return fr(known, 'rad');
    // ricerca della radice: secante da più partenze
    const starts = [1, 10, 0.1, 100, -1, 1000, 0.001, 1e4, 1e-5];
    for (const x0 of starts) { let a = x0, b = x0 * 1.1 + 0.01, fa = g(a), fb = g(b);
      for (let k = 0; k < 200 && isFinite(fb); k++) { if (Math.abs(fb) < 1e-12) return b; const nx = b - fb * (b - a) / (fb - fa); if (!isFinite(nx)) break; a = b; fa = fb; b = nx; fb = g(b); }
      if (isFinite(fb) && Math.abs(fb) < 1e-9 * (1 + Math.abs(known[lhs] || 0))) return b; }
    return NaN;
  }

  /* ================= ESERCIZI (seguono il percorso) ================= */
  const R = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const RZ = (a, b) => { let x = 0; while (!x) x = R(a, b); return x; };
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const sgn = (x, first) => x < 0 ? (first ? '−' : ' − ') + Math.abs(x) : (first ? '' : ' + ') + x;
  const term = (c, v, first) => (c < 0 ? (first ? '−' : ' − ') : (first ? '' : ' + ')) + (Math.abs(c) === 1 && v ? '' : Math.abs(c)) + v;
  const EL = [['H', 'Idrogeno', 1, 1.008, 1, 1], ['He', 'Elio', 2, 4.003, 1, 18], ['Li', 'Litio', 3, 6.94, 2, 1], ['Be', 'Berillio', 4, 9.012, 2, 2], ['B', 'Boro', 5, 10.81, 2, 13], ['C', 'Carbonio', 6, 12.01, 2, 14], ['N', 'Azoto', 7, 14.01, 2, 15], ['O', 'Ossigeno', 8, 16.00, 2, 16], ['F', 'Fluoro', 9, 19.00, 2, 17], ['Ne', 'Neon', 10, 20.18, 2, 18], ['Na', 'Sodio', 11, 22.99, 3, 1], ['Mg', 'Magnesio', 12, 24.31, 3, 2], ['Al', 'Alluminio', 13, 26.98, 3, 13], ['Si', 'Silicio', 14, 28.09, 3, 14], ['P', 'Fosforo', 15, 30.97, 3, 15], ['S', 'Zolfo', 16, 32.06, 3, 16], ['Cl', 'Cloro', 17, 35.45, 3, 17], ['Ar', 'Argon', 18, 39.95, 3, 18], ['K', 'Potassio', 19, 39.10, 4, 1], ['Ca', 'Calcio', 20, 40.08, 4, 2], ['Fe', 'Ferro', 26, 55.85, 4, 8], ['Cu', 'Rame', 29, 63.55, 4, 11], ['Zn', 'Zinco', 30, 65.38, 4, 12], ['Br', 'Bromo', 35, 79.90, 4, 17], ['Ag', 'Argento', 47, 107.87, 5, 11], ['I', 'Iodio', 53, 126.90, 5, 17], ['Au', 'Oro', 79, 196.97, 6, 11], ['Pb', 'Piombo', 82, 207.2, 6, 14]];
  const MOLEC = [['H2O', 18.02], ['CO2', 44.01], ['NaCl', 58.44], ['H2SO4', 98.08], ['NaOH', 40.00], ['HCl', 36.46], ['CaCO3', 100.09], ['NH3', 17.03], ['CH4', 16.04], ['O2', 32.00], ['C6H12O6', 180.16]];
  const GEN = [
    { id: 'espr', m: 'Matematica', t: 'Espressioni con i numeri interi', k: ['espression', 'numeri interi', 'interi relativi'], g() { const a = RZ(-9, 9), b = RZ(-9, 9), c = RZ(-6, 6), d = RZ(2, 5); const q = `${a} − (${b}) · ${c} + ${d}^2 − (${a}${sgn(c)})`; const ans = a - b * c + d * d - (a + c);
        return { q: 'Calcola: ' + q.replace('^2', '²'), a: ans, steps: ['Prima le potenze: ' + d + '² = ' + d * d, 'Poi le moltiplicazioni: (' + b + ')·' + c + ' = ' + b * c, 'Parentesi: (' + a + sgn(c) + ') = ' + (a + c), 'Somme algebriche da sinistra: ' + a + ' − (' + b * c + ') + ' + d * d + ' − (' + (a + c) + ') = ' + ans] }; } },
    { id: 'eq1', m: 'Matematica', t: 'Equazioni lineari intere', k: ['equazion', 'lineari', 'primo grado', '1° grado', 'intere'], g() { const x = RZ(-9, 9), a = RZ(-7, 7), c = RZ(-7, 7) || 1; if (a === c) return this.g(); const b = R(-15, 15), d = (a - c) * x + b;
        return { q: 'Risolvi:  ' + term(a, 'x', 1) + sgn(b) + ' = ' + term(c, 'x', 1) + sgn(d), a: x, steps: ['Porto le x a sinistra e i numeri a destra (cambiando segno): ' + term(a, 'x', 1) + ' ' + (c < 0 ? '+ ' + (-c) : '− ' + c) + 'x = ' + d + ' ' + (b < 0 ? '+ ' + (-b) : '− ' + b), 'Sommo: ' + (a - c) + 'x = ' + (d - b), 'Divido per ' + (a - c) + ': x = ' + (d - b) + '/' + (a - c) + ' = ' + x, 'Verifica: ' + (a * x + b) + ' = ' + (c * x + d) + ' ✓'] }; } },
    { id: 'eq1p', m: 'Matematica', t: 'Equazioni con le parentesi', k: ['equazion', 'parentesi', 'lineari'], g() { const x = RZ(-6, 6), a = RZ(2, 5), b = RZ(-6, 6), c = RZ(-4, 4); const k = RZ(1, 4); if (a === k) return this.g(); const rhs = k * x + (a * (x + b) + c - k * x);
        return { q: 'Risolvi:  ' + a + '(x' + sgn(b) + ')' + sgn(c) + ' = ' + term(k, 'x', 1) + sgn(rhs - k * x), a: x, steps: ['Tolgo la parentesi moltiplicando: ' + a + 'x' + sgn(a * b) + sgn(c), 'Porto le x a sinistra: ' + a + 'x − ' + k + 'x = ' + (rhs - k * x) + ' − (' + (a * b + c) + ')', 'Calcolo: ' + (a - k) + 'x = ' + ((rhs - k * x) - (a * b + c)), 'x = ' + x] }; } },
    { id: 'eq1f', m: 'Matematica', t: 'Equazioni a coefficienti frazionari', k: ['frazionari', 'coefficienti frazionari', 'equazion', 'frazion'], g() { const d1 = pick([2, 3, 4, 5, 6]), d2 = pick([2, 3, 4, 6]); const x = RZ(-4, 4) * d1; const n1 = RZ(1, 5), c = RZ(-5, 5); const rhs = n1 * x / d1 + c;
        const m = lcm(d1, d2); const rhsN = rhs * d2; if (!Number.isInteger(rhsN)) return this.g();
        return { q: 'Risolvi:  ' + n1 + 'x/' + d1 + sgn(c) + ' = ' + rhsN + '/' + d2, a: x, steps: ['m.c.m. dei denominatori ' + d1 + ' e ' + d2 + ' = ' + m, 'Moltiplico tutto per ' + m + ': ' + (n1 * m / d1) + 'x' + sgn(c * m) + ' = ' + (rhsN * m / d2), 'Isolo x: ' + (n1 * m / d1) + 'x = ' + (rhsN * m / d2 - c * m), 'x = ' + fmtFrac(x)] }; } },
    { id: 'prop', m: 'Matematica', t: 'Proporzioni', k: ['proporzion', 'rapporti'], g() { const a = RZ(2, 9), k = RZ(2, 6), c = RZ(2, 9); const b = a * k; return { q: 'Trova x:  ' + a + ' : ' + b + ' = ' + c + ' : x', a: b * c / a, steps: ['Prodotto dei medi = prodotto degli estremi: ' + a + '·x = ' + b + '·' + c, 'x = ' + b * c + '/' + a + ' = ' + fmtNum(b * c / a)] }; } },
    { id: 'pot', m: 'Matematica', t: 'Proprietà delle potenze', k: ['potenz'], g() { const b = RZ(2, 5), m = R(2, 6), n = R(1, 4); const tp = pick(['mul', 'div', 'pow']); const e = tp === 'mul' ? m + n : tp === 'div' ? m - n : m * n; const q = tp === 'mul' ? `${b}^${m} · ${b}^${n}` : tp === 'div' ? `${b}^${m} : ${b}^${n}` : `(${b}^${m})^${n}`;
        return { q: 'Scrivi come unica potenza e calcola l\'esponente: ' + q, a: e, unit: '(esponente)', steps: [tp === 'mul' ? 'Stessa base, prodotto: si sommano gli esponenti ' + m + '+' + n : tp === 'div' ? 'Stessa base, quoziente: si sottraggono ' + m + '−' + n : 'Potenza di potenza: si moltiplicano ' + m + '·' + n, '= ' + b + '^' + e] }; } },
    { id: 'notsci', m: 'Chimica', t: 'Notazione scientifica', k: ['notazione', 'misure', 'grandezze', 'scientifica'], g() { const m = R(11, 99) / 10, e = R(-6, 7); const x = m * 10 ** e; return { q: 'Scrivi in notazione scientifica ' + fmtNum(+x.toPrecision(2)) + ' : qual è l\'esponente di 10?', a: e, steps: ['Sposto la virgola finché resta una sola cifra non nulla prima: ' + String(m).replace('.', ','), 'Ho spostato di ' + Math.abs(e) + ' posti verso ' + (e >= 0 ? 'sinistra → esponente positivo' : 'destra → esponente negativo'), fmtNum(m) + ' · 10^' + e] }; } },
    { id: 'conv', m: 'Chimica', t: 'Equivalenze e unità SI', k: ['misure', 'grandezze', 'unità', 'equivalenz', 'sistema internazionale'], g() { const T = pick([['km', 'm', 1e3], ['m', 'cm', 100], ['mm', 'm', 1e-3], ['g', 'kg', 1e-3], ['kg', 'g', 1e3], ['L', 'mL', 1e3], ['mL', 'L', 1e-3], ['cm³', 'L', 1e-3], ['dm³', 'L', 1], ['m³', 'L', 1e3], ['h', 's', 3600], ['km/h', 'm/s', 1 / 3.6]]); const v = R(2, 950) / pick([1, 10]);
        return { q: 'Converti ' + fmtNum(v) + ' ' + T[0] + ' in ' + T[1], a: v * T[2], unit: T[1], tol: 1e-6, steps: ['1 ' + T[0] + ' = ' + fmtNum(T[2]) + ' ' + T[1], fmtNum(v) + ' × ' + fmtNum(T[2]) + ' = ' + fmtNum(v * T[2]) + ' ' + T[1]] }; } },
    { id: 'dens', m: 'Chimica', t: 'Densità, massa e volume', k: ['densit', 'massa', 'volume', 'misure'], g() { const M = pick([['acqua', 1], ['ferro', 7.87], ['alluminio', 2.7], ['rame', 8.96], ['olio', 0.92], ['oro', 19.3]]); const V = R(5, 200); const tp = R(0, 2);
        if (tp === 0) return { q: 'Un oggetto di ' + M[0] + ' ha volume ' + V + ' cm³. Densità ' + fmtNum(M[1]) + ' g/cm³. Massa?', a: M[1] * V, unit: 'g', tol: 0.01, steps: ['m = d · V', 'm = ' + fmtNum(M[1]) + ' · ' + V + ' = ' + fmtNum(M[1] * V) + ' g'] };
        if (tp === 1) return { q: 'Un blocco ha massa ' + fmtNum(M[1] * V) + ' g e volume ' + V + ' cm³. Densità?', a: M[1], unit: 'g/cm³', tol: 0.01, steps: ['d = m / V', 'd = ' + fmtNum(M[1] * V) + ' / ' + V + ' = ' + fmtNum(M[1]) + ' g/cm³ → è ' + M[0]] };
        return { q: 'Che volume occupano ' + fmtNum(M[1] * V) + ' g di ' + M[0] + ' (d = ' + fmtNum(M[1]) + ' g/cm³)?', a: V, unit: 'cm³', tol: 0.01, steps: ['V = m / d', 'V = ' + fmtNum(M[1] * V) + ' / ' + fmtNum(M[1]) + ' = ' + V + ' cm³'] }; } },
    { id: 'err', m: 'Fisica', t: 'Errori di misura', k: ['errori', 'misura', 'incertezza', 'media'], g() { const base = R(100, 300) / 10; const L = [0, 0, 0, 0].map(() => +(base + R(-5, 5) / 10).toFixed(1)); const mx = Math.max(...L), mn = Math.min(...L), med = L.reduce((a, b) => a + b) / 4, ea = (mx - mn) / 2;
        return { q: 'Misure: ' + L.map(x => fmtNum(x)).join(' ; ') + ' cm. Calcola l\'errore assoluto (semidispersione).', a: ea, unit: 'cm', tol: 0.001, steps: ['Valore medio = ' + fmtNum(med), 'Errore assoluto = (max − min)/2 = (' + fmtNum(mx) + ' − ' + fmtNum(mn) + ')/2 = ' + fmtNum(ea), 'Errore relativo = ' + fmtNum(ea) + '/' + fmtNum(med) + ' = ' + fmtNum(ea / med, 3) + ' (' + fmtNum(ea / med * 100, 3) + '%)'] }; } },
    { id: 'atomo', m: 'Chimica', t: 'Particelle dell\'atomo', k: ['atomo', 'particelle', 'protoni', 'neutroni', 'elettroni', 'isotop'], g() { const e = pick(EL.filter(x => x[2] > 2)); const A = Math.round(e[3]) + pick([0, 0, 1]); const tp = R(0, 2);
        if (tp === 0) return { q: e[1] + ' (' + e[0] + '): Z = ' + e[2] + ', A = ' + A + '. Quanti neutroni?', a: A - e[2], steps: ['Neutroni = A − Z', A + ' − ' + e[2] + ' = ' + (A - e[2])] };
        if (tp === 1) return { q: 'Quanti elettroni ha l\'atomo neutro di ' + e[1] + ' (Z = ' + e[2] + ')?', a: e[2], steps: ['Atomo neutro: elettroni = protoni = Z = ' + e[2]] };
        const ch = pick([1, 2, -1, -2]); return { q: 'Quanti elettroni ha lo ione ' + e[0] + (Math.abs(ch) > 1 ? Math.abs(ch) : '') + (ch > 0 ? '⁺' : '⁻') + ' (Z = ' + e[2] + ')?', a: e[2] - ch, steps: ['Ione positivo = ha perso elettroni, negativo = li ha acquistati', e[2] + (ch > 0 ? ' − ' : ' + ') + Math.abs(ch) + ' = ' + (e[2] - ch)] }; } },
    { id: 'tavola', m: 'Chimica', t: 'Sistema periodico', k: ['sistema periodico', 'tavola periodica', 'gruppo', 'periodo', 'elementi'], g() { const e = pick(EL); const tp = R(0, 1); return tp ? { q: 'In quale periodo (riga) si trova ' + e[1] + ' (' + e[0] + ')?', a: e[4], steps: ['Il periodo coincide con il numero di gusci elettronici occupati', e[1] + ' → periodo ' + e[4]] } : { q: 'In quale gruppo (colonna 1–18) si trova ' + e[1] + ' (' + e[0] + ')?', a: e[5], steps: [e[1] + ' → gruppo ' + e[5] + (e[5] === 1 ? ' (metalli alcalini)' : e[5] === 2 ? ' (alcalino-terrosi)' : e[5] === 17 ? ' (alogeni)' : e[5] === 18 ? ' (gas nobili)' : '')] }; } },
    { id: 'moli', m: 'Chimica', t: 'Moli e massa molare', k: ['mole', 'moli', 'massa molare', 'avogadro'], g() { const M = pick(MOLEC); const n = R(1, 40) / 10; const tp = R(0, 1);
        return tp ? { q: 'Quante moli ci sono in ' + fmtNum(+(n * M[1]).toFixed(2)) + ' g di ' + M[0] + ' (M = ' + fmtNum(M[1]) + ' g/mol)?', a: n, unit: 'mol', tol: 0.01, steps: ['n = m / M', 'n = ' + fmtNum(+(n * M[1]).toFixed(2)) + ' / ' + fmtNum(M[1]) + ' = ' + fmtNum(n) + ' mol'] } : { q: 'Massa di ' + fmtNum(n) + ' mol di ' + M[0] + ' (M = ' + fmtNum(M[1]) + ' g/mol)?', a: n * M[1], unit: 'g', tol: 0.01, steps: ['m = n · M', fmtNum(n) + ' · ' + fmtNum(M[1]) + ' = ' + fmtNum(n * M[1]) + ' g'] }; } },
    { id: 'mru', m: 'Fisica', t: 'Moto rettilineo uniforme', k: ['moto', 'velocit', 'cinematica', 'rettilineo'], g() { const v = R(5, 30), t = R(4, 60); const tp = R(0, 2);
        if (tp === 0) return { q: 'Un\'auto va a ' + v + ' m/s per ' + t + ' s. Quanta strada fa?', a: v * t, unit: 'm', steps: ['s = v · t', v + ' · ' + t + ' = ' + v * t + ' m'] };
        if (tp === 1) return { q: 'Percorre ' + v * t + ' m in ' + t + ' s. Velocità media?', a: v, unit: 'm/s', steps: ['v = s / t', v * t + ' / ' + t + ' = ' + v + ' m/s (= ' + fmtNum(v * 3.6) + ' km/h)'] };
        return { q: 'Quanto tempo serve per ' + v * t + ' m a ' + v + ' m/s?', a: t, unit: 's', steps: ['t = s / v', v * t + ' / ' + v + ' = ' + t + ' s'] }; } },
    { id: 'forze', m: 'Fisica', t: 'Forze, peso e pressione', k: ['forza', 'peso', 'pressione', 'newton', 'dinamica'], g() { const m = R(2, 120), a = R(1, 9), S = R(2, 50) / 100; const tp = R(0, 2);
        if (tp === 0) return { q: 'Quanto pesa (in N) una massa di ' + m + ' kg? (g = 9,81 m/s²)', a: m * 9.81, unit: 'N', tol: 0.01, steps: ['P = m · g', m + ' · 9,81 = ' + fmtNum(m * 9.81) + ' N'] };
        if (tp === 1) return { q: 'Forza necessaria per accelerare ' + m + ' kg a ' + a + ' m/s²?', a: m * a, unit: 'N', steps: ['F = m · a', m + ' · ' + a + ' = ' + m * a + ' N'] };
        return { q: 'Una forza di ' + m * 10 + ' N agisce su ' + fmtNum(S) + ' m². Pressione?', a: m * 10 / S, unit: 'Pa', tol: 0.01, steps: ['p = F / S', m * 10 + ' / ' + fmtNum(S) + ' = ' + fmtNum(m * 10 / S) + ' Pa'] }; } },
    { id: 'pitag', m: 'Matematica', t: 'Teorema di Pitagora', k: ['pitagora', 'triangol', 'geometria'], g() { const T = pick([[3, 4, 5], [5, 12, 13], [6, 8, 10], [8, 15, 17], [9, 12, 15], [7, 24, 25]]); const k = R(1, 3); const [a, b, c] = T.map(x => x * k); return R(0, 1) ? { q: 'Cateti ' + a + ' cm e ' + b + ' cm. Ipotenusa?', a: c, unit: 'cm', steps: ['i = √(a² + b²)', '√(' + a * a + ' + ' + b * b + ') = √' + c * c + ' = ' + c + ' cm'] } : { q: 'Ipotenusa ' + c + ' cm, un cateto ' + a + ' cm. L\'altro cateto?', a: b, unit: 'cm', steps: ['b = √(i² − a²)', '√(' + c * c + ' − ' + a * a + ') = √' + b * b + ' = ' + b + ' cm'] }; } },
    { id: 'taglio', m: 'Meccanica', t: 'Velocità di taglio e giri', k: ['tornio', 'fresatura', 'taglio', 'lavorazion', 'velocità di taglio'], g() { const D = pick([10, 16, 20, 25, 32, 40, 50, 63, 80]), Vt = pick([25, 30, 80, 120, 150, 200]); return { q: 'Diametro ' + D + ' mm, Vt = ' + Vt + ' m/min. Numero di giri del mandrino?', a: 1000 * Vt / (Math.PI * D), unit: 'giri/min', tol: 0.01, steps: ['n = 1000 · Vt / (π · D)', '1000 · ' + Vt + ' / (π · ' + D + ') = ' + fmtNum(1000 * Vt / (Math.PI * D), 5) + ' giri/min'] }; } },
  ];
  function consigliati(topics) {
    const T = (topics || []).map(norm).join(' | ');
    return GEN.map(g => ({ g, s: g.k.reduce((a, k) => a + (T.includes(norm(k)) ? 1 : 0), 0) })).sort((a, b) => b.s - a.s || a.g.m.localeCompare(b.g.m));
  }

  /* ================= INTERFACCIA ================= */
  const CSS = `.cx{--cxb:rgba(127,127,127,.12);--cxl:rgba(127,127,127,.3);font:inherit;color:inherit}
.cx .cxtabs{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px}.cx button{font:inherit;color:inherit;background:var(--cxb);border:1px solid var(--cxl);border-radius:8px;padding:7px 11px;cursor:pointer}
.cx button.on,.cx button.pri{background:#1d5c63;border-color:#1d5c63;color:#fff}.cx input,.cx select,.cx textarea{font:inherit;color:inherit;background:var(--cxb);border:1px solid var(--cxl);border-radius:8px;padding:8px;width:100%;box-sizing:border-box}
.cx .disp{font-family:ui-monospace,Menlo,monospace;font-size:20px;padding:12px;border-radius:10px;background:var(--cxb);min-height:30px;word-break:break-all}.cx .res{font-size:28px;font-weight:700;text-align:right;margin-top:6px;font-family:ui-monospace,Menlo,monospace}
.cx .keys{display:grid;grid-template-columns:repeat(6,1fr);gap:5px;margin-top:10px}.cx .keys button{padding:12px 0;font-size:15px}.cx .keys .op{background:rgba(29,92,99,.25)}.cx .keys .eq{background:#b5451b;color:#fff;border-color:#b5451b}
.cx .hist div{padding:5px 0;border-bottom:1px solid var(--cxl);cursor:pointer;font-family:ui-monospace,Menlo,monospace;font-size:13px}.cx .mut{opacity:.7;font-size:13px}.cx .step{padding:6px 10px;border-left:3px solid #1d5c63;margin:5px 0;background:var(--cxb);border-radius:0 6px 6px 0}
.cx .sol{font-size:20px;font-weight:700;margin:8px 0}.cx .grid2{display:grid;grid-template-columns:1fr 1fr;gap:8px}.cx .card{border:1px solid var(--cxl);border-radius:10px;padding:12px;margin:8px 0}
.cx .ok{color:#2e8b57;font-weight:700}.cx .ko{color:#c0392b;font-weight:700}.cx .row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.cx .pill{display:inline-block;padding:1px 8px;border-radius:10px;background:var(--cxb);font-size:12px;margin:2px}
@media(max-width:560px){.cx .grid2{grid-template-columns:1fr}.cx .keys button{padding:13px 0}}`;
  function mount(el, opt = {}) {
    if (!document.getElementById('cx-css')) { const st = document.createElement('style'); st.id = 'cx-css'; st.textContent = CSS; document.head.appendChild(st); }
    const topics = () => { try { return opt.topics ? opt.topics() : []; } catch (e) { return []; } };
    el.innerHTML = '<div class="cx"><div class="cxtabs"></div><div class="cxb"></div></div>';
    const tabs = { calc: '🧮 Calcolatrice', eq: '✖️ Equazioni', form: '📐 Formule', es: '🎯 Esercizi', guida: '❔ Guida' };
    const tb = el.querySelector('.cxtabs'), body = el.querySelector('.cxb');
    const show = t => { S.tab = t; save(); tb.innerHTML = Object.entries(tabs).map(([k, v]) => `<button data-t="${k}" class="${k === t ? 'on' : ''}">${v}</button>`).join(''); ({ calc: vCalc, eq: vEq, form: vForm, es: vEs, guida: vGuida })[t](body); };
    tb.onclick = e => { const t = e.target.dataset.t; if (t) show(t); };
    show(S.tab || 'calc');

    function vCalc(b) {
      const K = [['sin', 'f'], ['cos', 'f'], ['tan', 'f'], ['(', ''], [')', ''], ['⌫', 'del'], ['√', 'f'], ['x²', 'sq'], ['^', 'op'], ['7', ''], ['8', ''], ['9', ''], ['ln', 'f'], ['log', 'f'], ['÷', 'op'], ['4', ''], ['5', ''], ['6', ''], ['π', ''], ['e', ''], ['×', 'op'], ['1', ''], ['2', ''], ['3', ''], ['!', 'op'], ['%', 'op'], ['−', 'op'], ['0', ''], [',', ''], ['+', 'op'], ['ans', ''], ['x', ''], ['C', 'clr'], ['a b/c', 'frac'], ['DEG', 'mode'], ['=', 'eq']];
      b.innerHTML = `<div class="grid2"><div><input class="disp" id="cx_in" placeholder="es. 3/4 + 2,5·(1−√9)" autocomplete="off"><div class="res" id="cx_out">0</div><div class="mut" id="cx_alt"></div>
        <div class="keys">${K.map(([k, c]) => `<button class="${c === 'op' || c === 'f' || c === 'sq' ? 'op' : c === 'eq' ? 'eq' : ''}" data-k="${k}" data-c="${c}">${k === 'DEG' ? S.mode.toUpperCase() : k}</button>`).join('')}</div></div>
        <div><div class="card"><b>Memoria</b><div class="mut">Scrivi <code>m = 12,5</code> e premi = per salvare una variabile.</div><div id="cx_vars"></div></div><div class="card"><div class="row"><b>Cronologia</b><button id="cx_hc" style="margin-left:auto;padding:3px 8px">svuota</button></div><div class="hist" id="cx_h"></div></div></div></div>`;
      const inp = b.querySelector('#cx_in'), out = b.querySelector('#cx_out'), alt = b.querySelector('#cx_alt');
      let fracMode = false;
      const live = () => { const v = inp.value.trim(); if (!v) { out.textContent = '0'; alt.textContent = ''; return; } try { const m = v.match(/^([a-zA-Z_]\w*)\s*=(.*)$/); const x = calc(m ? m[2] : v); out.textContent = fracMode ? fmtFrac(x) : fmtNum(x); const f = toFrac(x); alt.textContent = (f && f[1] !== 1 ? 'frazione: ' + fmtFrac(x) + ' · ' : '') + (Math.abs(x) >= 1e4 || (Math.abs(x) < 0.01 && x) ? 'notazione sci.: ' + x.toExponential(4).replace('.', ',').replace('e', ' · 10^') : ''); out.style.opacity = 1; } catch (e) { out.style.opacity = .4; alt.textContent = e.message; } };
      const drawH = () => { b.querySelector('#cx_h').innerHTML = S.hist.slice(0, 30).map((h, i) => `<div data-i="${i}">${esc(h[0])} = <b>${esc(h[1])}</b></div>`).join('') || '<span class="mut">vuota</span>'; b.querySelector('#cx_vars').innerHTML = Object.entries(S.vars).map(([k, v]) => `<span class="pill">${esc(k)} = ${fmtNum(v)} <a href="#" data-del="${esc(k)}">×</a></span>`).join(''); };
      const ins = s => { const p = inp.selectionStart ?? inp.value.length; inp.setRangeText(s, p, inp.selectionEnd ?? p, 'end'); inp.focus(); live(); };
      const run = () => { const v = inp.value.trim(); if (!v) return; try { const m = v.match(/^([a-zA-Z_]\w*)\s*=(.*)$/); const x = calc(m ? m[2] : v); S.vars.ans = x; if (m) S.vars[m[1]] = x; S.hist.unshift([v, fmtBoth(x)]); S.hist = S.hist.slice(0, 100); save(); inp.value = m ? '' : String(+x.toPrecision(12)).replace('.', ','); live(); drawH(); } catch (e) { alt.textContent = '⚠ ' + e.message; } };
      b.querySelector('.keys').onclick = e => { const k = e.target.dataset.k, c = e.target.dataset.c; if (!k) return;
        if (c === 'eq') return run(); if (c === 'clr') { inp.value = ''; return live(); } if (c === 'del') { inp.value = inp.value.slice(0, -1); return live(); }
        if (c === 'mode') { S.mode = S.mode === 'deg' ? 'rad' : 'deg'; save(); e.target.textContent = S.mode.toUpperCase(); return live(); }
        if (c === 'frac') { fracMode = !fracMode; e.target.classList.toggle('on', fracMode); return live(); }
        if (c === 'f') return ins((k === '√' ? 'sqrt' : k) + '('); if (c === 'sq') return ins('^2'); ins(k === 'x' ? 'x' : k); };
      inp.oninput = live; inp.onkeydown = e => { if (e.key === 'Enter') run(); };
      b.querySelector('#cx_h').onclick = e => { const i = e.target.closest('[data-i]'); if (i) { inp.value = S.hist[+i.dataset.i][0]; live(); } };
      b.querySelector('#cx_vars').onclick = e => { const d = e.target.dataset.del; if (d) { e.preventDefault(); delete S.vars[d]; save(); drawH(); } };
      b.querySelector('#cx_hc').onclick = () => { S.hist = []; save(); drawH(); };
      drawH(); live();
    }
    function vEq(b) {
      b.innerHTML = `<div class="card"><b>Equazione in x</b> <span class="mut">(1° grado, 2° grado, frazioni, parentesi)</span><input id="cx_e" placeholder="es. 3(x−2) + x/2 = 2x + 5" value="${esc(S.lastEq || '')}" style="margin-top:6px"><div class="row" style="margin-top:6px"><button class="pri" id="cx_es">Risolvi con i passaggi</button><span class="mut">Esempi: <a href="#" data-x="2x + 3 = 5x − 9">2x+3=5x−9</a> · <a href="#" data-x="x/3 − 1/2 = x/4">x/3−1/2=x/4</a> · <a href="#" data-x="x^2 − 5x + 6 = 0">x²−5x+6=0</a></span></div><div id="cx_eo"></div></div>
      <div class="card"><b>Sistema 2×2 in x e y</b><div class="grid2" style="margin-top:6px"><input id="cx_s1" placeholder="2x + y = 7"><input id="cx_s2" placeholder="x − y = 2"></div><button class="pri" id="cx_ss" style="margin-top:6px">Risolvi</button><div id="cx_so"></div></div>`;
      const show = (o, r) => { o.innerHTML = (r.tipo ? `<div class="mut">Tipo: ${esc(r.tipo)}</div>` : '') + r.steps.map(s => `<div class="step">${esc(s)}</div>`).join('') + `<div class="sol">${esc(r.sol)}</div>`; };
      b.querySelector('#cx_es').onclick = () => { const v = b.querySelector('#cx_e').value; S.lastEq = v; save(); try { show(b.querySelector('#cx_eo'), solveEq(v)); } catch (e) { b.querySelector('#cx_eo').innerHTML = `<p class="ko">${esc(e.message)}</p>`; } };
      b.querySelector('#cx_e').onkeydown = e => { if (e.key === 'Enter') b.querySelector('#cx_es').click(); };
      b.onclick = e => { const x = e.target.dataset && e.target.dataset.x; if (x) { e.preventDefault(); b.querySelector('#cx_e').value = x; b.querySelector('#cx_es').click(); } };
      b.querySelector('#cx_ss').onclick = () => { try { show(b.querySelector('#cx_so'), solveSys(b.querySelector('#cx_s1').value, b.querySelector('#cx_s2').value)); } catch (e) { b.querySelector('#cx_so').innerHTML = `<p class="ko">${esc(e.message)}</p>`; } };
    }
    function vForm(b) {
      const mats = [...new Set(FORM.map(f => f[0]))]; let cur = S.fsel || 0;
      b.innerHTML = `<div class="row"><select id="cx_fm" style="max-width:340px">${mats.map(m => `<optgroup label="${m}">${FORM.map((f, i) => f[0] === m ? `<option value="${i}" ${i === cur ? 'selected' : ''}>${esc(f[1])}</option>` : '').join('')}</optgroup>`).join('')}</select><input id="cx_fq" placeholder="cerca formula…" style="max-width:220px"></div><div id="cx_fb"></div>`;
      const draw = () => { const f = FORM[cur]; const vars = Object.entries(f[3]);
        b.querySelector('#cx_fb').innerHTML = `<div class="card"><div class="sol" style="font-family:ui-monospace,Menlo,monospace">${esc(f[2].replace(/\*/g, '·').replace(/pi/g, 'π').replace(/sqrt/g, '√'))}</div><div class="mut">Compila i valori che conosci e lascia vuoto quello da trovare.</div>
          ${vars.map(([k, [d, u]]) => `<div class="row" style="margin:5px 0"><label style="min-width:170px">${esc(d)} <b>${esc(k)}</b></label><input data-v="${esc(k)}" style="max-width:180px" inputmode="decimal"><span class="mut">${esc(u)}</span></div>`).join('')}
          <button class="pri" id="cx_fs">Calcola</button><div id="cx_fo"></div></div>`;
        b.querySelector('#cx_fs').onclick = () => { const known = {}; let unk = null, n = 0; b.querySelectorAll('[data-v]').forEach(i => { const v = i.value.trim(); if (v === '') { unk = i.dataset.v; n++; } else known[i.dataset.v] = calc(v); });
          const o = b.querySelector('#cx_fo'); if (n !== 1) { o.innerHTML = '<p class="ko">Lascia vuoto un solo campo.</p>'; return; }
          const x = solveFormula(f, known, unk); const u = f[3][unk][1];
          o.innerHTML = isNaN(x) ? '<p class="ko">Non trovo una soluzione con questi valori.</p>' : `<div class="step">Formula: ${esc(f[2])}</div><div class="step">Sostituisco: ${Object.entries(known).map(([k, v]) => k + ' = ' + fmtNum(v)).join(' ; ')}</div>${unk !== f[2].split('=')[0].trim() ? '<div class="step">Ricavo ' + esc(unk) + ' dalla formula inversa</div>' : ''}<div class="sol">${esc(f[3][unk][0])} ${esc(unk)} = ${fmtNum(x)} ${esc(u)}</div>`; const inp = b.querySelector(`[data-v="${unk}"]`); if (!isNaN(x)) inp.placeholder = fmtNum(x); };
      };
      b.querySelector('#cx_fm').onchange = e => { cur = +e.target.value; S.fsel = cur; save(); draw(); };
      b.querySelector('#cx_fq').oninput = e => { const q = norm(e.target.value); const i = FORM.findIndex(f => norm(f[1] + ' ' + f[0] + ' ' + f[2]).includes(q)); if (q && i >= 0) { cur = i; b.querySelector('#cx_fm').value = i; draw(); } };
      draw();
    }
    function vEs(b) {
      const L = consigliati(topics()); const best = L.filter(x => x.s > 0);
      const st = id => S.stats[id] || { ok: 0, tot: 0 };
      b.innerHTML = `${best.length ? `<div class="card"><b>🎯 Consigliati per te</b> <span class="mut">in base agli argomenti delle ultime lezioni</span><div class="row" style="margin-top:6px">${best.slice(0, 6).map(x => `<button data-g="${x.g.id}" class="pri">${esc(x.g.t)}</button>`).join('')}</div></div>` : `<p class="mut">Quando segni gli argomenti delle lezioni nel diario, qui compaiono gli esercizi giusti per te.</p>`}
        ${['Matematica', 'Fisica', 'Chimica', 'Meccanica'].map(m => `<div class="card"><b>${m}</b><div class="row" style="margin-top:6px">${GEN.filter(g => g.m === m).map(g => { const s = st(g.id); return `<button data-g="${g.id}">${esc(g.t)}${s.tot ? ` <span class="pill">${s.ok}/${s.tot}</span>` : ''}</button>`; }).join('')}</div></div>`).join('')}<div id="cx_ex"></div>`;
      b.onclick = e => { const id = e.target.closest('[data-g]')?.dataset.g; if (id) esercizio(id); };
      function esercizio(id) {
        const G = GEN.find(g => g.id === id); let E; try { E = G.g(); } catch (e) { E = G.g(); }
        const cl = t => String(t).replace(/(^|[^\d,])1x/g, '$1x')	.replace(/\+ −/g, '− ').replace(/(^|[\s(=\/:])-(\d)/g, '$1−$2');E.q = cl(E.q); E.steps = E.steps.map(cl);
        const box = b.querySelector('#cx_ex'); box.innerHTML = `<div class="card" style="border-color:#1d5c63"><div class="mut">${esc(G.m)} · ${esc(G.t)}</div><div class="sol" style="font-weight:600">${esc(E.q)}</div>
          <div class="row"><input id="cx_ans" placeholder="la tua risposta${E.unit ? ' (' + E.unit + ')' : ''}" style="max-width:240px" inputmode="decimal"><button class="pri" id="cx_chk">Controlla</button><button id="cx_hint">💡 Aiuto</button><button id="cx_next">Nuovo ↻</button></div><div id="cx_fb2"></div></div>`;
        box.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); let hint = 0;
        const fb = box.querySelector('#cx_fb2');
        box.querySelector('#cx_chk').onclick = () => { let v; try { v = calc(box.querySelector('#cx_ans').value || 'x'); } catch (e) { fb.innerHTML = '<p class="ko">Scrivi un numero (anche frazione, es. 3/4).</p>'; return; }
          const tol = E.tol || 1e-9, ok = Math.abs(v - E.a) <= Math.max(tol * Math.abs(E.a), 1e-9) || (E.tol && Math.abs(v - E.a) <= E.tol * 10 && Math.abs(v - E.a) / Math.max(1, Math.abs(E.a)) < E.tol);
          const s = S.stats[id] = st(id); s.tot++; if (ok) s.ok++; save();
          fb.innerHTML = (ok ? `<p class="ok">✓ Giusto! ${fmtBoth(E.a)} ${esc(E.unit || '')}</p>` : `<p class="ko">✗ Non è ${fmtNum(v)}. Risultato: ${fmtBoth(E.a)} ${esc(E.unit || '')}</p>`) + E.steps.map(x => `<div class="step">${esc(x)}</div>`).join('') + `<p class="mut">Punteggio su questo argomento: ${s.ok}/${s.tot}</p>`; };
        box.querySelector('#cx_hint').onclick = () => { if (hint < E.steps.length - 1) fb.insertAdjacentHTML('beforeend', `<div class="step">💡 ${esc(E.steps[hint++])}</div>`); };
        box.querySelector('#cx_next').onclick = () => esercizio(id);
        box.querySelector('#cx_ans').onkeydown = e => { if (e.key === 'Enter') box.querySelector('#cx_chk').click(); };
      }
    }
    function vGuida(b) {
      b.innerHTML = `<div class="card"><b>Come si scrive</b><ul class="mut" style="line-height:1.7">
      <li>Virgola o punto per i decimali: <code>2,5</code> = <code>2.5</code></li><li>Moltiplicazione implicita: <code>2x</code>, <code>3(x+1)</code>, <code>2π</code></li>
      <li>Potenze <code>2^10</code> · radici <code>sqrt(2)</code>, <code>root(3;27)</code> · fattoriale <code>5!</code> · percentuale <code>20%</code></li>
      <li>Funzioni con più argomenti: separa con <b>;</b> → <code>log(2;8)</code>, <code>mcd(12;18)</code>, <code>mcm(4;6)</code>, <code>nCr(5;2)</code>, <code>round(3,14159;2)</code></li>
      <li>Costanti: <code>π e g c NA R G h qe</code> (g = 9,81) · Angoli: tasto DEG/RAD</li><li>Memoria: <code>r = 12</code> poi usa <code>r</code> nei calcoli; <code>ans</code> = ultimo risultato</li>
      <li>Tasto <b>a b/c</b>: risultato in frazione</li></ul></div>`;
    }
  }
  window.Calc = { mount, calc, solveEq, solveSys, toFrac, fmtNum, GEN, FORM };
})();
