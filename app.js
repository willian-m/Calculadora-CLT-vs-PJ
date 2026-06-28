/*
 * app.js — Lê o formulário, chama o núcleo (calc.js) e renderiza os resultados.
 */
(function () {
  'use strict';

  var C = window.CLTvsPJ;
  var brl = new Intl.NumberFormat('pt-BR', {
    style: 'currency', currency: 'BRL'
  });
  var fmt = function (v) { return brl.format(v || 0); };
  var num = function (id) { return parseFloat(document.getElementById(id).value) || 0; };
  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;')
      .replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // ---- Configuração de tabelas (personalizável, persistida em localStorage) --
  var CFG_KEY = 'cltvspj.cfg';
  function loadConfig() {
    try {
      var s = localStorage.getItem(CFG_KEY);
      if (!s) return C.defaults();
      return JSON.parse(s, function (k, v) { return v === '__INF__' ? Infinity : v; });
    } catch (e) { return C.defaults(); }
  }
  function saveConfig(cfg) {
    currentConfig = cfg;
    try {
      localStorage.setItem(CFG_KEY, JSON.stringify(cfg, function (k, v) {
        return v === Infinity ? '__INF__' : v;
      }));
    } catch (e) { /* localStorage pode estar indisponível */ }
  }
  var currentConfig = loadConfig();
  var lastInput = null;

  // ---- Campos condicionais ---------------------------------------------------
  function toggleConditionalFields() {
    var optante = document.getElementById('optanteSaque').value === 'sim';
    document.getElementById('anosAteSaque').closest('.field').style.display = '';
    // anos/inflação sempre úteis (retido no optante; total no não-optante)

    var regime = document.getElementById('regime').value;
    document.getElementById('ratField').hidden = (regime !== 'lucro');

    var modelo = document.getElementById('pjModelo').value;
    document.getElementById('aliquotaField').hidden = (modelo !== 'simples');
    document.getElementById('dasField').hidden = (modelo !== 'mei');
    return optante;
  }

  ['optanteSaque', 'regime', 'pjModelo'].forEach(function (id) {
    document.getElementById(id).addEventListener('change', toggleConditionalFields);
  });
  toggleConditionalFields();

  // ---- Coleta de input -------------------------------------------------------
  function readInput() {
    var beneficios = num('vr') + num('va') + num('vt') + num('saude') + num('odonto');
    var clt = {
      salarioMensal: num('salarioMensal'),
      optanteSaque: document.getElementById('optanteSaque').value === 'sim',
      anosAteSaque: num('anosAteSaque'),
      inflacao: num('inflacao') / 100,
      regime: document.getElementById('regime').value,
      rat: num('rat') / 100,
      beneficiosMensais: beneficios
    };
    var pj = {
      modelo: document.getElementById('pjModelo').value,
      dasMensal: num('pjDas'),
      aliquota: num('pjAliquota') / 100,
      contadorMensal: num('pjContador'),
      inssMensal: num('pjInss'),
      feriasPJ: document.getElementById('pjFerias').value === 'sim'
    };
    return { clt: clt, pj: pj };
  }

  // ---- Render helpers --------------------------------------------------------
  function infoIcon(tip) {
    return tip ? ' <span class="info" tabindex="0" data-tip="' + esc(tip) + '">i</span>' : '';
  }
  // Linha com valor mensal (média = anual ÷ 12) e anual.
  function row(label, annual, cls, tip) {
    return '<tr class="' + (cls || '') + '"><td>' + label + infoIcon(tip) + '</td><td>' +
      fmt((annual || 0) / 12) + '</td><td>' + fmt(annual) + '</td></tr>';
  }
  function tableHead() {
    return '<tr class="head"><td></td><td>/mês</td><td>/ano</td></tr>';
  }
  // Destaque com valor anual grande e mensal (média) abaixo.
  function headline(label, annual, cls, tip) {
    return '<div class="headline"><span class="label">' + label + infoIcon(tip) + '</span>' +
      '<span class="value ' + (cls || '') + '">' + fmt(annual) +
      '<small>' + fmt((annual || 0) / 12) + '/mês</small></span></div>';
  }
  function signed(value) {
    var cls = value >= 0 ? 'pos' : 'neg';
    var sign = value >= 0 ? '+' : '−';
    return '<span class="' + cls + '">' + sign + ' ' + fmt(Math.abs(value)) + '</span>';
  }

  function cenarioLabel(t) {
    if (t <= 0.02) return 'Cenário A — mesmo líquido do trabalhador';
    if (t >= 0.98) return 'Cenário B — mesmo custo para a empresa';
    return 'Intermediário — ' + Math.round(t * 100) + '% rumo ao custo do CLT';
  }

  // Painel PJ para um faturamento qualquer (recalculado pelo slider).
  function pjPanelHTML(o, clt, modeloLabel, cenLabel) {
    var deltaLiquido = o.liquido - clt.liquido;
    var deltaCusto = o.custoEmpresa - clt.custoEmpresa;
    return '<div class="panel pj"><h3>PJ — ' + modeloLabel + '</h3>' +
      '<span class="tag">' + cenLabel + '</span>' +
      headline('Líquido', o.liquido, 'pj',
        'O que o prestador recebe no ano: faturamento − impostos − custos fixos.') +
      headline('Custo da empresa', o.custoEmpresa, '',
        'Quanto a empresa paga no ano: o valor da nota emitida (sem encargos nem FGTS).') +
      '<table class="breakdown">' + tableHead() +
      row('Faturamento (nota)', o.nota, '',
        'Valor anual da nota emitida pelo PJ (= o que a empresa paga). Definido pela posição do slider entre os cenários A e B.') +
      row('(−) Impostos + custos fixos', -o.impostosCustos, 'sub',
        'Simples: alíquota efetiva sobre a nota. Mais custos fixos anuais (DAS do MEI, contador e INSS pró-labore), pagos nos 12 meses.') +
      row('Líquido do prestador', o.liquido, 'total',
        'Faturamento menos impostos e custos fixos.') +
      '</table>' +
      '<p class="hint">Mensalidade faturada: <strong>' + fmt(o.mensalidade) +
      '</strong> em ' + o.meses + ' faturamentos no ano.</p>' +
      '<table class="breakdown">' + tableHead() +
      row('Diferença de líquido vs CLT', deltaLiquido, 'sub',
        'Líquido do PJ menos o líquido do CLT, na posição atual do slider.') +
      row('Diferença de custo vs CLT', deltaCusto, 'sub',
        'Custo da empresa com o PJ menos o custo com o CLT.') +
      '</table></div>';
  }

  // ---- Render ----------------------------------------------------------------
  function render(input) {
    lastInput = input;
    var clt = C.calcCLT(input.clt, currentConfig);
    var pj = C.calcPJ(input.pj, clt);
    var modeloLabel = input.pj.modelo === 'mei' ? 'MEI (DAS fixo)' : 'Simples Nacional';

    var html = '';

    // --- Comparação A: mesmo líquido (paridade 12 meses) ---------------------
    var corpoA = pj.comFerias
      ? '<p>Cobrando <strong>' + fmt(pj.mensalidadeA) + '/mês</strong> (mensalidade que ' +
        'igualaria o CLT em 12 meses) e tirando férias (11 faturamentos), o PJ recebe ' +
        '<strong>' + fmt(pj.liquidoPJ_A) + '</strong> líquido/ano — <strong>' +
        fmt(pj.perdaFeriasA) + ' a menos</strong> que o CLT (férias não remuneradas) — ' +
        'e a empresa paga <strong>' + fmt(pj.custoEmpresaA) + '</strong>, contra <strong>' +
        fmt(clt.custoEmpresa) + '</strong> no CLT.</p>'
      : '<p>Para o PJ receber <strong>' + fmt(clt.liquido) + '</strong> líquido/ano, ' +
        'a empresa paga <strong>' + fmt(pj.custoEmpresaA) + '</strong>, contra <strong>' +
        fmt(clt.custoEmpresa) + '</strong> no CLT.</p>';
    html += '<div class="verdict">' +
      '<h4>Comparação A — mesmo líquido para o trabalhador</h4>' + corpoA +
      '<p>Economia da empresa indo de PJ: ' +
      signed(pj.economiaEmpresaA) + ' (' + pj.economiaEmpresaPctA.toFixed(1) + '%).</p>' +
      '</div>';

    // --- Comparação B: mesmo custo -------------------------------------------
    var corpoB = pj.comFerias
      ? '<p>Com orçamento de <strong>' + fmt(pj.mensalidadeB) + '/mês</strong> (custo do ' +
        'CLT ÷ 12) e 11 faturamentos, a empresa gasta <strong>' + fmt(pj.custoEmpresaB) +
        '</strong> e o PJ recebe <strong>' + fmt(pj.liquidoB) + '</strong> líquido/ano, ' +
        'contra <strong>' + fmt(clt.liquido) + '</strong> no CLT.</p>'
      : '<p>Se a empresa gastasse os mesmos <strong>' + fmt(clt.custoEmpresa) + '</strong> ' +
        'com um PJ, ele receberia <strong>' + fmt(pj.liquidoB) + '</strong> líquido/ano, ' +
        'contra <strong>' + fmt(clt.liquido) + '</strong> no CLT.</p>';
    html += '<div class="verdict">' +
      '<h4>Comparação B — mesmo custo para a empresa</h4>' + corpoB +
      '<p>Ganho do trabalhador indo de PJ: ' +
      signed(pj.ganhoLiquidoB) + ' (' + pj.ganhoLiquidoPctB.toFixed(1) + '%).</p>' +
      '</div>';

    if (pj.excedeMEI) {
      html += '<div class="alert">⚠ A nota anual ultrapassa o limite do MEI (' +
        fmt(pj.limiteMEI) + '/ano). Nesse faturamento o correto seria migrar para ME ' +
        '(Simples Nacional).</div>';
    }

    // --- Slider: faturamento do PJ entre o cenário A e o B -------------------
    var notaMin = Math.floor(pj.notaA);
    var notaMax = Math.ceil(pj.notaB);
    html += '<div class="slider-box">' +
      '<div class="slider-labels">' +
      '<span>Cenário A<br><small>mesmo líquido</small></span>' +
      '<span class="slider-readout" id="sliderReadout"></span>' +
      '<span class="right">Cenário B<br><small>mesmo custo</small></span></div>' +
      '<input type="range" id="pjSlider" min="' + notaMin + '" max="' + notaMax +
      '" value="' + notaMin + '" step="1">' +
      '<p class="hint">Arraste para variar o faturamento do PJ entre os dois cenários.</p>' +
      '</div>';

    // --- Painéis lado a lado --------------------------------------------------
    html += '<div class="cmp-grid">';

    // CLT (estático)
    html += '<div class="panel clt"><h3>CLT</h3>' +
      '<span class="tag">funcionário registrado</span>' +
      headline('Líquido', clt.liquido, 'clt',
        'O que o funcionário efetivamente recebe no ano: bruto − INSS − IRPF + FGTS aproveitável (a valor presente).') +
      headline('Custo da empresa', clt.custoEmpresa, '',
        'Quanto a empresa desembolsa no ano: remuneração + FGTS + provisão de multa + encargos patronais + benefícios.') +
      '<table class="breakdown">' + tableHead() +
      row('Salário bruto anual (12 +13º +⅓)', clt.salarioBrutoAnual, '',
        'Base anual de remuneração: 12 salários + 1 salário de 13º + 1/3 do salário (terço de férias).') +
      row('(−) INSS', -clt.inssAnual, 'sub',
        'Tabela progressiva mensal aplicada a 11 meses normais, ao mês de férias (salário + 1/3) e ao 13º. Limitado ao teto mensal de contribuição.') +
      row('(−) IRPF (tabela)', -clt.irBruto, 'sub',
        'Imposto de Renda pela tabela anual, sobre o bruto anual menos o INSS. Sem dependentes ou outras deduções.') +
      (clt.irRedutor > 0 ? row('(+) Redutor IR 2026', clt.irRedutor, 'sub',
        'Redutor de 2026 sobre os rendimentos tributáveis anuais: isenta quem ganha até R$60 mil/ano e reduz gradualmente até R$88,2 mil. Limitado ao imposto apurado (não fica negativo).') : '') +
      row('(+) FGTS aproveitável (VP)', clt.fgtsValor, 'sub',
        'Parte do FGTS que o trabalhador de fato aproveita, a valor presente. Optante do saque-aniversário: saque do ano + remanescente descontado pela inflação. Não-optante: depósito total descontado pela inflação até o saque.') +
      row('Líquido do funcionário', clt.liquido, 'total',
        'Bruto anual − INSS − IRPF + FGTS aproveitável.') +
      '</table>' +
      '<table class="breakdown">' + tableHead() +
      row('Remuneração anual', clt.salarioBrutoAnual, '',
        'Salário + 13º + terço de férias: base sobre a qual incidem FGTS e encargos.') +
      row('(+) FGTS', clt.fgtsDeposito, 'sub',
        'Percentual (padrão 8%) da remuneração anual, depositado pela empresa. Incide também sobre 13º e terço.') +
      row('(+) Provisão de multa', clt.multaProvisao, 'sub',
        'Provisão (padrão 40%) sobre o FGTS depositado, para a multa rescisória.') +
      row('(+) Encargos patronais', clt.encargosPatronais, 'sub',
        'Lucro Presumido/Real: INSS patronal (20%) + RAT + Sistema S (5,8%) sobre a remuneração. Simples Nacional: isento. Percentuais editáveis nas configurações.') +
      row('(+) Benefícios', clt.beneficiosAnuais, 'sub',
        'Soma anual de VR, VA, VT, plano de saúde e odontológico informados (×12).') +
      row('Custo total da empresa', clt.custoEmpresa, 'total',
        'Remuneração + FGTS + provisão de multa + encargos + benefícios.') +
      '</table></div>';

    // PJ (preenchido pelo slider)
    html += '<div id="pjPanel"></div>';

    html += '</div>'; // cmp-grid

    var el = document.getElementById('resultados');
    el.innerHTML = html;
    el.hidden = false;

    // --- Liga o slider ao painel PJ -----------------------------------------
    var pjParams = input.pj;
    var slider = document.getElementById('pjSlider');
    var readout = document.getElementById('sliderReadout');
    var panel = document.getElementById('pjPanel');
    function updatePJ() {
      var nota = parseFloat(slider.value);
      var range = notaMax - notaMin;
      var t = range > 0 ? (nota - notaMin) / range : 0;
      var o = C.pjPorNota(pjParams, nota);
      panel.innerHTML = pjPanelHTML(o, clt, modeloLabel, cenarioLabel(t));
      readout.innerHTML = '<strong>' + fmt(o.mensalidade) + '/mês</strong> · ' +
        fmt(o.nota) + '/ano<br><span class="muted">' + cenarioLabel(t) + '</span>';
    }
    slider.addEventListener('input', updatePJ);
    updatePJ();

    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // ---- Submit ----------------------------------------------------------------
  document.getElementById('form').addEventListener('submit', function (e) {
    e.preventDefault();
    render(readInput());
  });

  // ---- Configurações (modal) -------------------------------------------------
  function cfgField(label, id, value, step) {
    return '<label class="field"><span>' + label + '</span>' +
      '<input type="number" id="' + id + '" step="' + (step || '0.01') +
      '" value="' + value + '"></label>';
  }

  // Tabela editável de faixas. lastInfinite: última faixa tem limite ∞ (sem input).
  function cfgTable(group, headers, faixas, lastInfinite) {
    var h = '<table class="cfg-table"><tr>';
    headers.forEach(function (x) { h += '<th>' + x + '</th>'; });
    h += '</tr>';
    faixas.forEach(function (f, i) {
      var isLast = i === faixas.length - 1;
      h += '<tr>';
      h += (lastInfinite && isLast)
        ? '<td class="inf" title="Sem limite superior">∞</td>'
        : '<td><input type="number" step="0.01" data-g="' + group + '" data-r="' + i +
          '" data-c="0" value="' + f[0] + '"></td>';
      h += '<td><input type="number" step="0.1" data-g="' + group + '" data-r="' + i +
        '" data-c="1" value="' + (f[1] * 100) + '"></td>';
      h += '<td><input type="number" step="0.01" data-g="' + group + '" data-r="' + i +
        '" data-c="2" value="' + f[2] + '"></td>';
      h += '</tr>';
    });
    return h + '</table>';
  }

  function buildSettingsForm(cfg) {
    return '<div class="modal-card">' +
      '<div class="modal-head"><h2>Configurações</h2>' +
      '<button type="button" class="modal-close" id="cfgClose" aria-label="Fechar">×</button></div>' +
      '<p class="desc">Personalize as tabelas e alíquotas usadas nos cálculos. ' +
      'Os valores ficam salvos neste navegador. Alíquotas em %.</p>' +

      '<div class="cfg-group"><h3>INSS (mensal)</h3>' +
      '<div class="cfg-scalars">' + cfgField('Teto de contribuição (R$)', 'cfgInssTeto', cfg.inssTeto) + '</div>' +
      cfgTable('inssFaixas', ['Faixa até (R$)', 'Alíquota (%)', 'Parcela a deduzir (R$)'], cfg.inssFaixas, false) +
      '</div>' +

      '<div class="cfg-group"><h3>IRPF (anual)</h3>' +
      cfgTable('irpfFaixas', ['Base até (R$)', 'Alíquota (%)', 'Parcela a deduzir (R$)'], cfg.irpfFaixas, true) +
      '</div>' +

      '<div class="cfg-group"><h3>Saque-aniversário do FGTS</h3>' +
      cfgTable('saqueFaixas', ['Saldo até (R$)', 'Alíquota (%)', 'Parcela adicional (R$)'], cfg.saqueFaixas, true) +
      '</div>' +

      '<div class="cfg-group"><h3>FGTS e encargos</h3><div class="cfg-scalars">' +
      cfgField('FGTS (%)', 'cfgFgts', cfg.fgtsAliquota * 100, '0.1') +
      cfgField('Provisão de multa (%)', 'cfgMulta', cfg.multaRescisoria * 100, '1') +
      cfgField('INSS patronal (%)', 'cfgPatronal', cfg.inssPatronal * 100, '0.1') +
      cfgField('Sistema S (%)', 'cfgSistemaS', cfg.sistemaS * 100, '0.1') +
      '</div></div>' +

      '<div class="cfg-group"><h3>Redutor do IR (2026)</h3><div class="cfg-scalars">' +
      cfgField('Redução máxima (R$)', 'cfgRedMax', cfg.irRedutor.max) +
      cfgField('Isenção total até (R$)', 'cfgRedLimite', cfg.irRedutor.limite, '1000') +
      cfgField('Termo do phase-out (R$)', 'cfgRedBase', cfg.irRedutor.base) +
      cfgField('Coeficiente', 'cfgRedTaxa', cfg.irRedutor.taxa, '0.000001') +
      cfgField('Fim do phase-out (R$)', 'cfgRedFim', cfg.irRedutor.fim, '1000') +
      '</div></div>' +

      '<div class="modal-actions">' +
      '<button type="button" class="btn-secondary" id="cfgReset">Restaurar padrões</button>' +
      '<button type="button" id="cfgSave">Salvar</button>' +
      '</div></div>';
  }

  function readSettingsForm() {
    var cfg = C.defaults(); // estrutura correta, incluindo limites ∞
    var inputs = document.querySelectorAll('#settingsModal input[data-g]');
    Array.prototype.forEach.call(inputs, function (inp) {
      var g = inp.getAttribute('data-g');
      var r = +inp.getAttribute('data-r');
      var c = +inp.getAttribute('data-c');
      var v = parseFloat(inp.value);
      if (isNaN(v)) v = 0;
      if (c === 1) v = v / 100; // alíquota em %
      cfg[g][r][c] = v;
    });
    cfg.inssTeto = parseFloat(document.getElementById('cfgInssTeto').value) || 0;
    // mantém o limite da última faixa do INSS coerente com o teto
    cfg.inssFaixas[cfg.inssFaixas.length - 1][0] = cfg.inssTeto;
    cfg.fgtsAliquota = (parseFloat(document.getElementById('cfgFgts').value) || 0) / 100;
    cfg.multaRescisoria = (parseFloat(document.getElementById('cfgMulta').value) || 0) / 100;
    cfg.inssPatronal = (parseFloat(document.getElementById('cfgPatronal').value) || 0) / 100;
    cfg.sistemaS = (parseFloat(document.getElementById('cfgSistemaS').value) || 0) / 100;
    cfg.irRedutor = {
      max: parseFloat(document.getElementById('cfgRedMax').value) || 0,
      limite: parseFloat(document.getElementById('cfgRedLimite').value) || 0,
      base: parseFloat(document.getElementById('cfgRedBase').value) || 0,
      taxa: parseFloat(document.getElementById('cfgRedTaxa').value) || 0,
      fim: parseFloat(document.getElementById('cfgRedFim').value) || 0
    };
    return cfg;
  }

  var modal = document.getElementById('settingsModal');
  function closeSettings() { modal.hidden = true; modal.innerHTML = ''; }
  function openSettings(cfg) {
    modal.innerHTML = buildSettingsForm(cfg || currentConfig);
    modal.hidden = false;
    document.getElementById('cfgClose').addEventListener('click', closeSettings);
    document.getElementById('cfgReset').addEventListener('click', function () {
      openSettings(C.defaults()); // repopula com padrões (só efetiva ao Salvar)
    });
    document.getElementById('cfgSave').addEventListener('click', function () {
      saveConfig(readSettingsForm());
      closeSettings();
      if (lastInput) render(lastInput);
    });
  }
  modal.addEventListener('click', function (e) { if (e.target === modal) closeSettings(); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !modal.hidden) closeSettings();
  });
  document.getElementById('settingsBtn').addEventListener('click', function () {
    openSettings(currentConfig);
  });
})();
