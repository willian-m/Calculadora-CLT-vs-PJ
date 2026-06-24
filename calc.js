/*
 * calc.js — Núcleo financeiro da calculadora CLT vs PJ.
 *
 * Funções PURAS, sem DOM. Todos os valores monetários em reais (números).
 * Bases anuais. Ver premissas/simplificações documentadas no rodapé da página.
 *
 * Funciona tanto no browser (anexado a `window`/`globalThis`) quanto no Node
 * (`module.exports`), para permitir testar a matemática headless.
 */
(function (root) {
  'use strict';

  // ---------------------------------------------------------------------------
  // Tabelas (parametrizadas conforme a diretiva em CLAUDE.md)
  // ---------------------------------------------------------------------------

  var INSS_TETO = 8475.55; // teto de contribuição mensal

  // Faixas mensais: [limiteSuperior, aliquota, parcelaDeduzir]
  var INSS_FAIXAS = [
    [1621.00, 0.075, 0],
    [2902.84, 0.090, 24.32],
    [4354.27, 0.120, 111.40],
    [8475.55, 0.140, 198.49]
  ];

  // Faixas IRPF anual: [limiteSuperior, aliquota, parcelaDeduzir]
  var IRPF_FAIXAS = [
    [28467.20, 0.000, 0],
    [33919.80, 0.075, 2135.04],
    [45012.60, 0.150, 4679.03],
    [55976.16, 0.225, 8054.97],
    [Infinity, 0.275, 10853.78]
  ];

  // Saque-aniversário: [saldoSuperior, aliquota, parcelaAdicional]
  var SAQUE_FAIXAS = [
    [500.00, 0.50, 0],
    [1000.00, 0.40, 50],
    [5000.00, 0.30, 150],
    [10000.00, 0.20, 650],
    [15000.00, 0.15, 1150],
    [20000.00, 0.10, 1900],
    [Infinity, 0.05, 2900]
  ];

  function round2(v) {
    // Arredonda para 2 casas (meio-para-cima), corrigindo o erro de
    // representação IEEE-754 que faz valores como 121,575 caírem para baixo.
    var scaled = v * 100;
    var nudged = scaled + (scaled >= 0 ? 1 : -1) * 1e-9;
    return Math.round(nudged) / 100;
  }

  // ---------------------------------------------------------------------------
  // Funções de tabela
  // ---------------------------------------------------------------------------

  // INSS mensal sobre uma base de remuneração.
  // Acima do teto, a contribuição é limitada à da própria faixa de 14% no teto
  // (fórmula contínua: teto*14% - 198,49 = 988,09).
  function inssMensal(base) {
    if (base <= 0) return 0;
    var b = Math.min(base, INSS_TETO);
    for (var i = 0; i < INSS_FAIXAS.length; i++) {
      var f = INSS_FAIXAS[i];
      if (b <= f[0]) return round2(b * f[1] - f[2]);
    }
    return round2(INSS_TETO * 0.14 - 198.49);
  }

  // IRPF anual sobre a base de cálculo (rendimento tributável - INSS).
  function irpfAnual(base) {
    if (base <= 0) return 0;
    for (var i = 0; i < IRPF_FAIXAS.length; i++) {
      var f = IRPF_FAIXAS[i];
      if (base <= f[0]) return round2(Math.max(0, base * f[1] - f[2]));
    }
    return 0;
  }

  // Saque-aniversário sobre o saldo (aqui: depósito FGTS do ano).
  function saqueAniversario(saldo) {
    if (saldo <= 0) return 0;
    for (var i = 0; i < SAQUE_FAIXAS.length; i++) {
      var f = SAQUE_FAIXAS[i];
      if (saldo <= f[0]) return round2(saldo * f[1] + f[2]);
    }
    return 0;
  }

  function valorPresente(valorFuturo, taxaAnual, anos) {
    if (anos <= 0) return valorFuturo;
    return valorFuturo / Math.pow(1 + taxaAnual, anos);
  }

  // ---------------------------------------------------------------------------
  // CLT
  // ---------------------------------------------------------------------------

  /*
   * input:
   *   salarioMensal        number
   *   optanteSaque         boolean  (saque-aniversário)
   *   anosAteSaque         number   (horizonte p/ traz. a VP do FGTS retido)
   *   inflacao             number   (ex.: 0.04)
   *   regime               'simples' | 'lucro'
   *   rat                  number   (ex.: 0.02; só usado em 'lucro')
   *   beneficiosMensais    number   (VR+VA+VT+saúde+odonto somados, /mês)
   */
  function calcCLT(input) {
    var S = input.salarioMensal;
    var terco = S / 3;                       // terço de férias
    var G = 12 * S + S + terco;              // salário + 13º + terço (base anual)

    // INSS: 11 meses normais + mês de férias (salário + terço) + 13º
    var inssMesNormal = inssMensal(S);
    var inssMesFerias = inssMensal(S + terco);
    var inssDecimoTerceiro = inssMensal(S);
    var inssAnual = round2(11 * inssMesNormal + inssMesFerias + inssDecimoTerceiro);

    // IRPF anual sobre a base agregada (simplificação: 13º e terço incluídos)
    var baseIR = G - inssAnual;
    var irAnual = irpfAnual(baseIR);

    // FGTS depositado no ano (8% sobre G, incide sobre 13º e terço)
    var fgtsDeposito = round2(0.08 * G);

    // Valor do FGTS efetivamente aproveitado pelo funcionário
    var saqueValor = 0;
    var remanescente = 0;
    var remanescenteVP = 0;
    var fgtsValor;
    if (input.optanteSaque) {
      saqueValor = saqueAniversario(fgtsDeposito);
      remanescente = round2(fgtsDeposito - saqueValor);
      remanescenteVP = round2(valorPresente(remanescente, input.inflacao, input.anosAteSaque));
      fgtsValor = round2(saqueValor + remanescenteVP);
    } else {
      fgtsValor = round2(valorPresente(fgtsDeposito, input.inflacao, input.anosAteSaque));
    }

    var liquido = round2(G - inssAnual - irAnual + fgtsValor);

    // Custo da empresa
    var encargos = 0;
    if (input.regime === 'lucro') {
      encargos = round2((0.20 + (input.rat || 0) + 0.058) * G);
    }
    var multaProvisao = round2(0.40 * fgtsDeposito);
    var beneficiosAnuais = round2((input.beneficiosMensais || 0) * 12);
    var custoEmpresa = round2(
      G + fgtsDeposito + multaProvisao + encargos + beneficiosAnuais
    );

    return {
      salarioBrutoAnual: round2(G),
      decimoTerceiro: round2(S),
      tercoFerias: round2(terco),
      inssAnual: inssAnual,
      irAnual: irAnual,
      fgtsDeposito: fgtsDeposito,
      saqueAniversario: saqueValor,
      fgtsRemanescente: remanescente,
      fgtsRemanescenteVP: remanescenteVP,
      fgtsValor: fgtsValor,
      liquido: liquido,
      encargosPatronais: encargos,
      multaProvisao: multaProvisao,
      beneficiosAnuais: beneficiosAnuais,
      custoEmpresa: custoEmpresa
    };
  }

  // ---------------------------------------------------------------------------
  // PJ
  // ---------------------------------------------------------------------------

  /*
   * pj:
   *   modelo        'mei' | 'simples'
   *   dasMensal     number (mei)
   *   aliquota      number (simples, ex.: 0.06)
   *   contadorMensal number
   *   inssMensal    number (pró-labore opcional)
   *
   * Retorna funções de conversão nota<->líquido e custos fixos.
   */
  function pjCustosFixos(pj) {
    var contador = (pj.contadorMensal || 0) * 12;
    var inss = (pj.inssMensal || 0) * 12;
    if (pj.modelo === 'mei') {
      return round2((pj.dasMensal || 0) * 12 + contador + inss);
    }
    return round2(contador + inss); // simples: % aplicada sobre a nota
  }

  // Líquido do PJ dada a nota (faturamento anual).
  function pjLiquidoDaNota(pj, nota) {
    var fixos = pjCustosFixos(pj);
    if (pj.modelo === 'mei') {
      return round2(nota - fixos);
    }
    return round2(nota * (1 - (pj.aliquota || 0)) - fixos);
  }

  // Nota necessária para o PJ receber determinado líquido.
  function pjNotaParaLiquido(pj, liquidoAlvo) {
    var fixos = pjCustosFixos(pj);
    if (pj.modelo === 'mei') {
      return round2(liquidoAlvo + fixos);
    }
    return round2((liquidoAlvo + fixos) / (1 - (pj.aliquota || 0)));
  }

  /*
   * Calcula os dois sentidos da comparação PJ contra um resultado CLT.
   *   clt: saída de calcCLT (usa .liquido e .custoEmpresa)
   *   pj : parâmetros acima, mais:
   *     feriasPJ  boolean — se true, o PJ fatura 11 meses em vez de 12.
   *
   * Modelo de férias ("perde 1 mês"): a mensalidade é a de paridade com o CLT
   * em 12 meses; com férias o PJ recebe apenas 11 faturamentos, então o líquido
   * dele e o custo da empresa caem ~1/12. Os custos fixos (DAS/contador/INSS)
   * continuam sendo pagos nos 12 meses.
   */
  function calcPJ(pj, clt) {
    var LIMITE_MEI = 81000;
    var meses = pj.feriasPJ ? 11 : 12;
    var r = pj.modelo === 'simples' ? (pj.aliquota || 0) : 0;
    var fixos = pjCustosFixos(pj); // anual (sempre 12 meses)

    // Líquido anual a partir de uma receita anual (impostos % + custos fixos)
    function netFromRev(rev) { return round2(rev * (1 - r) - fixos); }

    // --- Direção A: mensalidade que iguala o líquido do CLT em 12 meses -----
    var notaParidadeA = (clt.liquido + fixos) / (1 - r); // receita anual p/ 12 meses
    var mensalidadeA = round2(notaParidadeA / 12);
    var notaA = round2(meses * (notaParidadeA / 12));    // receita anual efetiva
    var custoEmpresaA = notaA;                            // empresa paga só a nota
    var liquidoPJ_A = netFromRev(notaA);                 // = clt.liquido se 12 meses
    var perdaFeriasA = round2(clt.liquido - liquidoPJ_A); // 0 se 12; ~1 mês se 11
    var economiaEmpresaA = round2(clt.custoEmpresa - custoEmpresaA);
    var economiaEmpresaPctA = clt.custoEmpresa
      ? round2((economiaEmpresaA / clt.custoEmpresa) * 100)
      : 0;

    // --- Direção B: orçamento mensal = custo CLT / 12, pago `meses` vezes ----
    var mensalidadeB = round2(clt.custoEmpresa / 12);
    var notaB = round2(meses * (clt.custoEmpresa / 12));
    var custoEmpresaB = notaB;                            // < custo CLT se houver férias
    var liquidoB = netFromRev(notaB);
    var ganhoLiquidoB = round2(liquidoB - clt.liquido);
    var ganhoLiquidoPctB = clt.liquido
      ? round2((ganhoLiquidoB / clt.liquido) * 100)
      : 0;

    return {
      meses: meses,
      comFerias: pj.feriasPJ === true,
      custosFixosAnuais: fixos,
      // Direção A
      mensalidadeA: mensalidadeA,
      notaA: notaA,
      custoEmpresaA: custoEmpresaA,
      liquidoPJ_A: liquidoPJ_A,
      perdaFeriasA: perdaFeriasA,
      economiaEmpresaA: economiaEmpresaA,
      economiaEmpresaPctA: economiaEmpresaPctA,
      // Direção B
      mensalidadeB: mensalidadeB,
      notaB: notaB,
      custoEmpresaB: custoEmpresaB,
      liquidoB: liquidoB,
      ganhoLiquidoB: ganhoLiquidoB,
      ganhoLiquidoPctB: ganhoLiquidoPctB,
      // Alertas
      excedeMEI: pj.modelo === 'mei' && (notaA > LIMITE_MEI || notaB > LIMITE_MEI),
      limiteMEI: LIMITE_MEI
    };
  }

  // ---------------------------------------------------------------------------
  // Export
  // ---------------------------------------------------------------------------

  var api = {
    inssMensal: inssMensal,
    irpfAnual: irpfAnual,
    saqueAniversario: saqueAniversario,
    valorPresente: valorPresente,
    calcCLT: calcCLT,
    calcPJ: calcPJ,
    pjLiquidoDaNota: pjLiquidoDaNota,
    pjNotaParaLiquido: pjNotaParaLiquido,
    round2: round2,
    INSS_TETO: INSS_TETO
  };

  root.CLTvsPJ = api;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
