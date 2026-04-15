function interpretarMensagem(texto) {
  texto = texto.toLowerCase();

  let tipo = "gasto";
  let valor = 0;
  let parcelas = 1;
  let descricao = texto;

  // detectar entrada
  if (texto.includes("recebi") || texto.includes("ganhei")) {
    tipo = "entrada";
  }

  // detectar parcelas PRIMEIRO (pra não confundir com o valor)
  const parcelasMatch = texto.match(/(\d+)x/);
  if (parcelasMatch) {
    parcelas = parseInt(parcelasMatch[1]);
    // removemos o "10x" para não atrapalhar a busca do valor
    texto = texto.replace(/(\d+)x/, "");
  }

  // pegar valor (agora no texto sem o '10x')
  const valorMatch = texto.match(/(\d+[\.,]?\d*)/);
  if (valorMatch) {
    valor = parseFloat(valorMatch[1].replace(",", "."));
  }

  // limpar descrição
  descricao = texto
    .replace(/(\d+[\.,]?\d*)/g, "")
    .replace("comprei", "")
    .replace("por", "")
    .replace(/\s+/g, " ")
    .trim();

  return { tipo, valor, parcelas, descricao };
}

// Testes
const testes = [
  "mercado 50",
  "geladeira 1200 10x",
  "10x geladeira 1200",
  "recebi 2000",
  "paguei 50.50 no lanche 2x"
];

testes.forEach(t => {
  console.log(`Input: "${t}"`);
  console.log("Resultado:", interpretarMensagem(t));
  console.log("---");
});
