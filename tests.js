/*
 * tests.js — Asserções da matemática do calc.js.
 * Roda no Node (`node tests.js`) e no browser (via tests.html).
 */
(function (root) {
  'use strict';

  var C = root.CLTvsPJ || (typeof require !== 'undefined' && require('./calc.js'));

  var results = [];
  function approx(a, b, tol) {
    return Math.abs(a - b) <= (tol == null ? 0.01 : tol);
  }
  function check(name, actual, expected, tol) {
    var ok = approx(actual, expected, tol);
    results.push({ name: name, ok: ok, actual: actual, expected: expected });
  }

  // ---- INSS mensal (faixas e fronteiras) -----------------------------------
  check('INSS faixa 7,5% (1000)', C.inssMensal(1000), 75.00);
  check('INSS fronteira 1621', C.inssMensal(1621), 121.58);
  check('INSS faixa 9% (2000)', C.inssMensal(2000), 155.68);
  check('INSS faixa 12% (3000)', C.inssMensal(3000), 248.60);
  check('INSS faixa 14% (5000)', C.inssMensal(5000), 501.51);
  check('INSS no teto (8475.55)', C.inssMensal(8475.55), 988.09);
  check('INSS acima do teto (10000) limitado ao teto', C.inssMensal(10000), 988.09);
  check('INSS zero', C.inssMensal(0), 0);

  // ---- IRPF anual ----------------------------------------------------------
  check('IRPF isento (20000)', C.irpfAnual(20000), 0);
  check('IRPF 7,5% (30000)', C.irpfAnual(30000), 30000 * 0.075 - 2135.04);
  check('IRPF 15% (40000)', C.irpfAnual(40000), 40000 * 0.15 - 4679.03);
  check('IRPF 22,5% (50000)', C.irpfAnual(50000), 50000 * 0.225 - 8054.97);
  check('IRPF 27,5% (117907.79)', C.irpfAnual(117907.79), 117907.79 * 0.275 - 10853.78);

  // ---- Saque-aniversário ---------------------------------------------------
  check('Saque 50% (400)', C.saqueAniversario(400), 200.00);
  check('Saque 40% +50 (800)', C.saqueAniversario(800), 800 * 0.40 + 50);
  check('Saque 30% +150 (3000)', C.saqueAniversario(3000), 3000 * 0.30 + 150);
  check('Saque 20% +650 (8000)', C.saqueAniversario(8000), 8000 * 0.20 + 650);
  check('Saque 5% +2900 (25000)', C.saqueAniversario(25000), 25000 * 0.05 + 2900);

  // ---- Valor presente ------------------------------------------------------
  check('VP 10000 @4% 5 anos', C.valorPresente(10000, 0.04, 5), 10000 / Math.pow(1.04, 5), 0.01);
  check('VP anos=0 retorna face', C.valorPresente(10000, 0.04, 0), 10000);

  // ---- CLT integrado (S=10000, não-optante, lucro presumido/real) ----------
  var cltLucro = C.calcCLT({
    salarioMensal: 10000,
    optanteSaque: false,
    anosAteSaque: 5,
    inflacao: 0.04,
    regime: 'lucro',
    rat: 0.02,
    beneficiosMensais: 0
  });
  check('CLT G anual', cltLucro.salarioBrutoAnual, 133333.33);
  check('CLT INSS anual', cltLucro.inssAnual, 13 * 988.09, 0.02);
  check('CLT IR anual', cltLucro.irAnual, C.irpfAnual(133333.33 - 13 * 988.09), 0.05);
  check('CLT FGTS depósito', cltLucro.fgtsDeposito, 0.08 * 133333.33, 0.02);
  check('CLT FGTS valor (VP)', cltLucro.fgtsValor,
    C.valorPresente(0.08 * 133333.33, 0.04, 5), 0.05);
  // encargos lucro = (0.20+0.02+0.058)*G
  check('CLT encargos lucro', cltLucro.encargosPatronais, 0.278 * 133333.33, 0.02);
  check('CLT multa 40% FGTS', cltLucro.multaProvisao, 0.40 * cltLucro.fgtsDeposito, 0.02);

  // ---- CLT regime Simples: encargos patronais = 0 --------------------------
  var cltSimples = C.calcCLT({
    salarioMensal: 10000, optanteSaque: false, anosAteSaque: 5,
    inflacao: 0.04, regime: 'simples', rat: 0.02, beneficiosMensais: 0
  });
  check('CLT Simples sem encargos patronais', cltSimples.encargosPatronais, 0);
  check('CLT Simples custo < custo Lucro',
    cltSimples.custoEmpresa < cltLucro.custoEmpresa ? 1 : 0, 1);

  // ---- CLT optante saque-aniversário muda o valor do FGTS ------------------
  var cltOpt = C.calcCLT({
    salarioMensal: 10000, optanteSaque: true, anosAteSaque: 5,
    inflacao: 0.04, regime: 'lucro', rat: 0.02, beneficiosMensais: 0
  });
  check('CLT optante: saque > 0', cltOpt.saqueAniversario > 0 ? 1 : 0, 1);
  check('CLT optante: fgtsValor difere do não-optante',
    Math.abs(cltOpt.fgtsValor - cltLucro.fgtsValor) > 0.01 ? 1 : 0, 1);

  // ---- PJ MEI: direção A e B -----------------------------------------------
  var pjMEI = C.calcPJ(
    { modelo: 'mei', dasMensal: 76, contadorMensal: 0, inssMensal: 0 },
    cltLucro
  );
  // notaA = liquido + DAS*12
  check('PJ MEI notaA', pjMEI.notaA, cltLucro.liquido + 76 * 12, 0.02);
  check('PJ MEI custoEmpresaA == notaA', pjMEI.custoEmpresaA, pjMEI.notaA);
  // liquidoB = custoCLT - DAS*12
  check('PJ MEI liquidoB', pjMEI.liquidoB, cltLucro.custoEmpresa - 76 * 12, 0.02);
  // com salário alto a nota excede o teto MEI
  check('PJ MEI excede limite (R$81k)', pjMEI.excedeMEI ? 1 : 0, 1);

  // ---- PJ Simples: direção A e B -------------------------------------------
  var pjSimples = C.calcPJ(
    { modelo: 'simples', aliquota: 0.06, contadorMensal: 200, inssMensal: 0 },
    cltLucro
  );
  var fixos = 200 * 12;
  check('PJ Simples notaA', pjSimples.notaA, (cltLucro.liquido + fixos) / 0.94, 0.02);
  check('PJ Simples liquidoB', pjSimples.liquidoB,
    cltLucro.custoEmpresa * 0.94 - fixos, 0.02);
  // sanidade: na direção A o PJ tem o mesmo líquido -> recomputar nota dá o líquido
  check('PJ Simples consistência A',
    C.pjLiquidoDaNota({ modelo: 'simples', aliquota: 0.06, contadorMensal: 200 }, pjSimples.notaA),
    cltLucro.liquido, 0.02);

  // ---- Relatório -----------------------------------------------------------
  var passed = results.filter(function (r) { return r.ok; }).length;
  var failed = results.length - passed;

  function report(emit) {
    results.forEach(function (r) {
      emit(
        (r.ok ? 'PASS' : 'FAIL') + '  ' + r.name +
        (r.ok ? '' : '  (esperado ' + r.expected + ', obtido ' + r.actual + ')'),
        r.ok
      );
    });
    emit('-----', true);
    emit(passed + ' passaram, ' + failed + ' falharam', failed === 0);
  }

  if (typeof module !== 'undefined' && module.exports) {
    // Node
    report(function (line, ok) { console.log(line); });
    process.exit(failed === 0 ? 0 : 1);
  } else {
    // Browser
    root.__TESTS__ = { results: results, passed: passed, failed: failed, report: report };
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
