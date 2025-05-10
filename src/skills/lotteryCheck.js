export default async function lotteryCheck(modalidade, sorteio = '') {
  console.log(`Iniciando verificação de loteria para modalidade: ${modalidade}, sorteio: ${sorteio}`);
  const sorteios = ['megasena', 'lotofacil', 'quina', 'lotomania', 'timemania', 'duplasena', 'supersete', 'loteca', 'diadesorte'];
  
  let uri = `https://servicebus2.caixa.gov.br/portaldeloterias/api/home/ultimos-resultados`;
  
  if (sorteio && !sorteios.includes(modalidade)) {
    return 'Modalidade inválida. As modalidades disponíveis são: ' + sorteios.join(', ');
  } else if (sorteio && sorteios.includes(modalidade)) {
    uri = `https://servicebus2.caixa.gov.br/portaldeloterias/api/${modalidade}/${sorteio}`;
  }
  
  if (sorteio && !/^\d+$/.test(sorteio)) {
    return 'Sorteio inválido. O sorteio deve ser um número.';
  }
  
  const request = await fetch(uri);
  const data = await request.json();
  
  return data
}