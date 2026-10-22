import { parseMjPublication } from "./mj-publication.ts";

function assertEquals(actual: unknown, expected: unknown, label: string) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${label}\n  esperado: ${e}\n  obtido:   ${a}`);
}

const HEADER = `Publica-se que em relação à entidade:
Nº de Matrícula/NIPC: 500000000
Firma: EXEMPLO TESTE, LDA
Natureza Jurídica: SOCIEDADE POR QUOTAS
Sede: Rua das Flores, 10, 2º Esq
Distrito: Lisboa Concelho: Lisboa Freguesia: Carnide
1600 - 416 LISBOA

pela Apresentação AP. 1/20261016, referente à inscrição 1,
foi efectuado o seguinte acto de registo:
`;

Deno.test("constituição: sede, objeto, capital, sócio e gerente com email", () => {
  const text = `${HEADER}
Insc. 1 - AP. 1/20261016 21:00:02 UTC - CONSTITUIÇÃO DE SOCIEDADE, DESIGNAÇÃO DE MEMBRO(S) DE ÓRGÃO(S) SOCIAL(AIS)

OBJECTO: Edição de outros programas informáticos, Actividades de programação informática.
CAPITAL : 100,00 Euros
Data de Encerramento do Exercício : 31 Dezembro

SÓCIOS E QUOTAS:

QUOTA : 100,00 Euros

TITULAR: ANA EXEMPLO
NIF/NIPC: 111111111
Estado civil : Casado(a) - Nacionalidade: Portuguesa
Residência/Sede: Rua Privada, 1

FORMA DE OBRIGAR/ÓRGÃOS SOCIAIS:

Forma de obrigar: Com a intervenção de 1 gerente.

ORGÃO(S) DESIGNADO(S):

GERÊNCIA:

Nome/Firma: ANA EXEMPLO
NIF/NIPC: 111111111
Cargo: Gerente
Residência/Sede: Rua Privada, 1
Endereço eletrónico: Ana@Exemplo.pt
`;
  const result = parseMjPublication(text, "Constituição de sociedade, designação de membro(s) de órgão(s) social(ais)");
  assertEquals(result.natureza_juridica, "SOCIEDADE POR QUOTAS", "natureza");
  assertEquals(result.sede, { morada: "Rua das Flores, 10, 2º Esq", codigo_postal: "1600-416", localidade: "LISBOA", freguesia: "Carnide", concelho: "Lisboa", distrito: "Lisboa" }, "sede");
  assertEquals(result.objeto, "Edição de outros programas informáticos, Actividades de programação informática.", "objeto");
  assertEquals(result.capital, "100,00 Euros", "capital");
  assertEquals(result.socios, [{ nome: "ANA EXEMPLO", nif: "111111111", cargo: "Sócio", email: null }], "socios");
  assertEquals(result.gerentes, [{ nome: "ANA EXEMPLO", nif: "111111111", cargo: "Gerente", email: "ana@exemplo.pt" }], "gerentes");
});

Deno.test("cessação: gerente que sai não é importado", () => {
  const text = `${HEADER}
Av. 1 - AP. 36/20260917 10:16:20 UTC - CESSAÇÃO DE FUNÇÕES DE MEMBRO(S) DO(S) ORGÃO(S) SOCIAL(AIS)

GERÊNCIA:

Nome/Firma: RUI SAÍDA
NIF/NIPC: 222222222
Causa: Renúncia
Data: 2026.08.19
`;
  const result = parseMjPublication(text, "Cessação de funções de membro(s) do(s) orgão(s) social(ais)");
  assertEquals(result.gerentes, [], "gerentes");
  assertEquals(result.sede.concelho, "Lisboa", "concelho");
});

Deno.test("designação sem cargo explícito usa o título da secção", () => {
  const text = `${HEADER}
Insc. 3 - AP. 2/20261001 UTC - DESIGNAÇÃO DE MEMBRO(S) DE ORGÃO(S) SOCIAL(AIS)

CONSELHO DE ADMINISTRAÇÃO:

Nome/Firma: JOANA ADMIN
NIF/NIPC: 333333333

Nome/Firma: PEDRO ADMIN
NIF/NIPC: 444444444
Cargo: Presidente
`;
  const result = parseMjPublication(text, "Designação de membro(s) de orgão(s) social(ais)");
  assertEquals(result.gerentes.map((p) => [p.nome, p.cargo]), [["JOANA ADMIN", "Administrador"], ["PEDRO ADMIN", "Presidente"]], "gerentes");
});

Deno.test("alteração ao contrato: vários sócios, sem gerentes", () => {
  const text = `${HEADER}
Insc. 2 - AP. 2/20260801 00:16:48 UTC - ALTERAÇÕES AO CONTRATO DE SOCIEDADE(ONLINE)

SÓCIOS E QUOTAS:

QUOTA : 350,00 Euros

TITULAR: SOCIO UM
NIF/NIPC: 555555555
Estado civil : Divorciado(a)

QUOTA : 300,00 Euros

TITULAR: SOCIO DOIS
NIF/NIPC: 666666666

Artigo(s) alterado(s): 4.º e 7.º
`;
  const result = parseMjPublication(text, "Alterações ao contrato de sociedade(online)");
  assertEquals(result.socios.map((p) => p.nif), ["555555555", "666666666"], "socios");
  assertEquals(result.gerentes, [], "gerentes");
  assertEquals(result.objeto, null, "objeto");
});

Deno.test("prestação de contas: código postal só com 4 dígitos", () => {
  const text = `Publica-se que em relação à entidade:
Firma: EXEMPLO, LDA
Natureza Jurídica: SOCIEDADE POR QUOTAS
Sede: Avenida da Praia, nº 1 - Almograve
Distrito: Beja Concelho: Odemira Freguesia: Longueira/Almograve
7630 Almograve

Matriculada na: CRPC Odemira

pelo pedido Dep 441/2026-10-21, foi efectuado o seguinte acto de registo:

DEP 441/2026-10-21 18:17:51 UTC - ACTUALIZAÇÃO PRESTAÇÃO DE CONTAS INDIVIDUAL
`;
  const result = parseMjPublication(text, "PRESTAÇÃO DE CONTAS INDIVIDUAL");
  assertEquals([result.sede.codigo_postal, result.sede.localidade, result.sede.freguesia], ["7630", "Almograve", "Longueira/Almograve"], "sede");
});

Deno.test("mudança de sede: só dados da sede", () => {
  const text = HEADER.replace("1600 - 416 LISBOA", "3060 - 197 Cantanhede") + `
Insc. 9 - AP. 9/20261012 14:26:33 UTC - MUDANÇA DA SEDE (ATUALIZAÇÃO DA TOPONÍMIA)

Artigo(s) alterado(s): 1º nº1
`;
  const result = parseMjPublication(text, "Mudança da sede");
  assertEquals([result.sede.codigo_postal, result.sede.localidade], ["3060-197", "Cantanhede"], "cp");
  assertEquals([result.gerentes.length, result.socios.length], [0, 0], "pessoas");
});
