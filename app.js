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
  function row(label, value, cls) {
    return '<tr class="' + (cls || '') + '"><td>' + label +
      '</td><td>' + fmt(value) + '</td></tr>';
  }
  function signed(value) {
    var cls = value >= 0 ? 'pos' : 'neg';
    var sign = value >= 0 ? '+' : '−';
    return '<span class="' + cls + '">' + sign + ' ' + fmt(Math.abs(value)) + '</span>';
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

    // --- Painéis lado a lado --------------------------------------------------
    html += '<div class="cmp-grid">';

    // CLT
    html += '<div class="panel clt"><h3>CLT</h3>' +
      '<span class="tag">funcionário registrado</span>' +
      '<div class="headline"><span class="label">Líquido/ano</span>' +
      '<span class="value clt">' + fmt(clt.liquido) + '</span></div>' +
      '<div class="headline"><span class="label">Custo da empresa/ano</span>' +
      '<span class="value">' + fmt(clt.custoEmpresa) + '</span></div>' +
      '<table class="breakdown">' +
      row('Salário bruto anual (12 +13º +⅓)', clt.salarioBrutoAnual) +
      row('(−) INSS', -clt.inssAnual, 'sub') +
      row('(−) IRPF', -clt.irAnual, 'sub') +
      row('(+) FGTS aproveitável (VP)', clt.fgtsValor, 'sub') +
      row('Líquido do funcionário', clt.liquido, 'total') +
      '</table>' +
      '<table class="breakdown">' +
      row('Remuneração anual', clt.salarioBrutoAnual) +
      row('(+) FGTS 8%', clt.fgtsDeposito, 'sub') +
      row('(+) Provisão multa 40%', clt.multaProvisao, 'sub') +
      row('(+) Encargos patronais', clt.encargosPatronais, 'sub') +
      row('(+) Benefícios', clt.beneficiosAnuais, 'sub') +
      row('Custo total da empresa', clt.custoEmpresa, 'total') +
      '</table></div>';

    // PJ (Comparação A)
    var pjTag = pj.comFerias
      ? '11 faturamentos · mensalidade de paridade (Comparação A)'
      : 'mesmo líquido do CLT (Comparação A)';
    html += '<div class="panel pj"><h3>PJ — ' + modeloLabel + '</h3>' +
      '<span class="tag">' + pjTag + '</span>' +
      '<div class="headline"><span class="label">Líquido/ano</span>' +
      '<span class="value pj">' + fmt(pj.liquidoPJ_A) + '</span></div>' +
      '<div class="headline"><span class="label">Custo da empresa/ano</span>' +
      '<span class="value">' + fmt(pj.custoEmpresaA) + '</span></div>' +
      '<table class="breakdown">' +
      row('Mensalidade de paridade (R$/mês)', pj.mensalidadeA, 'sub') +
      row('Nota anual (× ' + pj.meses + ' faturamentos)', pj.notaA) +
      row('(−) Impostos + custos fixos', -(pj.notaA - pj.liquidoPJ_A), 'sub') +
      row('Líquido do prestador', pj.liquidoPJ_A, 'total') +
      '</table>' +
      '<table class="breakdown">' +
      row('Custos fixos anuais (DAS/contador/INSS)', pj.custosFixosAnuais, 'sub') +
      row('Custo total da empresa', pj.custoEmpresaA, 'total') +
      '</table></div>';

    html += '</div>'; // cmp-grid

    var el = document.getElementById('resultados');
    el.innerHTML = html;
    el.hidden = false;
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // ---- Submit ----------------------------------------------------------------
  document.getElementById('form').addEventListener('submit', function (e) {
    e.preventDefault();
    render(readInput());
  });
})();
