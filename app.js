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
  // Linha com valor mensal (média = anual ÷ 12) e anual.
  function row(label, annual, cls) {
    return '<tr class="' + (cls || '') + '"><td>' + label + '</td><td>' +
      fmt((annual || 0) / 12) + '</td><td>' + fmt(annual) + '</td></tr>';
  }
  function tableHead() {
    return '<tr class="head"><td></td><td>/mês</td><td>/ano</td></tr>';
  }
  // Destaque com valor anual grande e mensal (média) abaixo.
  function headline(label, annual, cls) {
    return '<div class="headline"><span class="label">' + label + '</span>' +
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
      headline('Líquido', o.liquido, 'pj') +
      headline('Custo da empresa', o.custoEmpresa, '') +
      '<table class="breakdown">' + tableHead() +
      row('Faturamento (nota)', o.nota) +
      row('(−) Impostos + custos fixos', -o.impostosCustos, 'sub') +
      row('Líquido do prestador', o.liquido, 'total') +
      '</table>' +
      '<p class="hint">Mensalidade faturada: <strong>' + fmt(o.mensalidade) +
      '</strong> em ' + o.meses + ' faturamentos no ano.</p>' +
      '<table class="breakdown">' + tableHead() +
      row('Diferença de líquido vs CLT', deltaLiquido, 'sub') +
      row('Diferença de custo vs CLT', deltaCusto, 'sub') +
      '</table></div>';
  }

  // ---- Render ----------------------------------------------------------------
  function render(input) {
    var clt = C.calcCLT(input.clt);
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
      headline('Líquido', clt.liquido, 'clt') +
      headline('Custo da empresa', clt.custoEmpresa, '') +
      '<table class="breakdown">' + tableHead() +
      row('Salário bruto anual (12 +13º +⅓)', clt.salarioBrutoAnual) +
      row('(−) INSS', -clt.inssAnual, 'sub') +
      row('(−) IRPF', -clt.irAnual, 'sub') +
      row('(+) FGTS aproveitável (VP)', clt.fgtsValor, 'sub') +
      row('Líquido do funcionário', clt.liquido, 'total') +
      '</table>' +
      '<table class="breakdown">' + tableHead() +
      row('Remuneração anual', clt.salarioBrutoAnual) +
      row('(+) FGTS 8%', clt.fgtsDeposito, 'sub') +
      row('(+) Provisão multa 40%', clt.multaProvisao, 'sub') +
      row('(+) Encargos patronais', clt.encargosPatronais, 'sub') +
      row('(+) Benefícios', clt.beneficiosAnuais, 'sub') +
      row('Custo total da empresa', clt.custoEmpresa, 'total') +
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
})();
