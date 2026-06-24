Quero fazer uma página simples. Ela não terá backend, só scripts executando direto no
browser, permitindo fácil hospedagem. Ela será uma calculadora que avalie o quanto um funcionário recebe anualmente CLT e comparar com o custo de uma pessoa PJ que recebe líquido a mesma quantia. Então levante:

1. O quanto custa para uma empresa manter um funcionário CLT.
2. O quanto o funcionário recebe de fato.

O input deve ser o valor do salário mensal bruto do funcionário, que é o que o RH tipicamente paga.

Depois, quero considerar o que popularmente é chamado de "empregado PJ". A pessoa abre uma MEI ou similar e presta serviços para a empresa. Novamente, neste cenário, deve ser calculado:

1. O quanto custa para uma empresa manter a pessoa prestando serviço.
2. O quanto a pessoa recebe líquido de fato.

Em ambos os casos, o cálculo de salários líquidos e custo para a empresa deve ser usando o salário anual. Isto permite incorporar como salário líquido do funcionário o 13o, terço de férias. FGTS é mais delicado porque ele em tese é pago como benefício ao funcionário, mas ele não pode usar de fato. Neste caso, no form a ser gerado, peça para o usuário escolher:

1. Optante do saque aniversário? Se sim, o valor de saque anual será contado no salário anual.
2. Caso contrário, o usuário terá de informar quanto tempo até o saque. Use isto para trazer o saque futuro ao valor presente usando uma taxa de inflação que o usuário escolhe. Padrão de 4%. O mesmo deve ser feito com o valor remanescente não sacado do saque aniversário.

Alguns detalhes:

1. 13o salário é um salário adicional pago ao funcionário
2. O funcionário, quando sai de férias, recebe 1/3 do salário além do salário normal, como uma espécie de bônus
3. Use a tabela abaixo para calcular IR
Base de cálculo (R$) | Alíquota do IRPF | Valor a deduzir (R$)
--- | --- | --- 
Até 28.467,20 | isento | -
De 28.467,21 a 33.919,80 | 7,5% | 2.135,04
De 33.919,81 a 45.012,60 | 15% | 4.679,03
De 45.012,61 a 55.976,16 | 22,5% | 8.054,97
Acima de 55.976,16 | 27,5% | 10.853,78

4. Para cálculo de INSS, use a tabela abaixo
Salário (de) | Salário (até) | Alíquota | Parcela a deduzir
--- | --- | --- | ---
R$0,00 | R$1.621,00 | 7,5%	–
R$1.621,01 | R$2.902,84 | 9,0% | R$24,32
R$2.902,85 | R$4.354,27 | 12,0% | R$111,40
R$4.354,28 | R$8.475,55 | 14,0% | R$198,49

Lembrando que acima de R$8.475,55, é cobrado fixo R$8.475,55 x 14%. INSS é cobrado mensalmente e incide sobre 13o e do adicional de férias.

4. FGTS é 8% do salário bruto, depositado pela empresa e sem desconto do salário do empregado
5. Saque aniversário
O valor depende do saldo total nas contas do FGTS e segue uma tabela progressiva. A alíquota varia de 5% a 50%, com uma parcela adicional fixa. Eis abaixo: 
- Até R$ 500 Alíquota: 50%.
- De R$ 500,01 a R$ 1.000 Alíquota: 40%; Parcela adicional: R$ 50.
- De R$ 1.000,01 a R$ 5.000 Alíquota: 30%; Parcela adicional: R$ 150.
- De R$ 5.000,01 a R$ 10.000 Alíquota: 20%; Parcela adicional: R$ 650.
- De R$ 10.000,01 a R$ 15.000 Alíquota: 15%; Parcela adicional: R$ 1.150.
- De R$ 15.000,01 a R$ 20.000 Alíquota: 10%; Parcela adicional: R$ 1.900.
- Acima de R$ 20.000 Alíquota: 5%; Parcela adicional: R$ 2.900
Considere para o valor o tanto depositado no ano
6. Considere 20% de INSS patronal
7. Considere como custo 40% do valor pago do FGTS como provisão para pagar multa rescisória
8. Use também este texto para te guiar
9. Impostos e Contribuições
- Empresas do Simples Nacional: Geralmente são isentas da cota patronal do INSS. O custo extra obrigatório fica em torno de 28% a 40% sobre o salário (incluindo o FGTS e as provisões).
- Empresas do Lucro Presumido ou Real: Pagam o INSS Patronal (20%), RAT (1% a 3%) e Sistema S (5,8%).
10. Inclua também a opção de custos com VR, VA, VT, plano de saúde e odontológico

---

# Implementação

Página estática (sem backend, sem build) que roda direto no browser via `file://`
ou servidor estático. Compara, em base anual, CLT vs PJ.

## Arquivos

| Arquivo | Papel |
|---|---|
| `index.html` | Formulário (salário, FGTS, regime do empregador, benefícios, cenário PJ) + área de resultados |
| `styles.css` | Tema escuro responsivo; painéis CLT/PJ lado a lado |
| `calc.js` | Núcleo financeiro — **funções puras** sem DOM, exportadas em `window`/`module.exports` |
| `app.js` | Lê o form, chama `calc.js`, renderiza e formata em BRL (`Intl.NumberFormat`) |
| `tests.js` / `tests.html` | 38 asserções da matemática; rodam no Node e no browser |
| `Makefile` | `make serve` (porta 8888) e `make test` |

## API do núcleo (`calc.js` → `window.CLTvsPJ`)

- `inssMensal(base)` — tabela progressiva mensal; teto R$8.475,55 (máx. R$988,09/mês, fórmula contínua).
- `irpfAnual(base)` — tabela anual da diretiva.
- `saqueAniversario(saldo)` — tabela progressiva; saldo = depósito FGTS do ano.
- `valorPresente(vf, taxa, anos)`.
- `calcCLT(input)` → líquido do funcionário e custo da empresa.
- `calcPJ(pj, clt)` → comparação nos dois sentidos (mesmo líquido / mesmo custo).

## Modelo

- Base anual `G = 12·S + 13º + ⅓ férias`.
- INSS: 11 meses + mês de férias (salário+terço) + 13º.
- IRPF anual sobre `G − INSS` (13º/terço agregados — simplificação).
- FGTS 8% sobre `G`; optante do saque-aniversário saca pela tabela e o retido vai a
  valor presente; não-optante traz o total a VP (`anos até saque`, inflação default 4%).
- Custo CLT: `G` + FGTS + multa 40% + encargos patronais (Simples=0; Lucro Presumido/Real
  = 20% + RAT + 5,8% Sistema S) + benefícios.
- PJ: empresa paga só a nota. MEI (DAS fixo, alerta de limite R$81k/ano) ou Simples
  (alíquota efetiva), com contador e INSS pró-labore opcionais.
- Férias no PJ (opcional): a mensalidade é a de paridade com o CLT em 12 meses; com
  férias o PJ fatura 11 meses → líquido e custo da empresa caem ~1/12 ("perde 1 mês").
  Custos fixos seguem 12 meses. INSS pró-labore tem orientação no form (ex.: igualar à
  contribuição que pagaria como CLT).

## Como rodar

```sh
make serve     # http://localhost:8888
make test      # asserções no node
```

Verificação: `make test` deve mostrar "38 passaram, 0 falharam"; abrir
`tests.html` (tudo verde) e `index.html` no browser.

## Premissas / decisões

- INSS acima do teto: fórmula contínua (sem a descontinuidade do "teto×14%").
- Branch padrão do repo: `master`.
- Ferramenta educativa; não substitui cálculo contábil oficial.
