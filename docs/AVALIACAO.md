# Avaliação do algoritmo

## Como rodar

```bash
npm test             # testes do Brain e do algoritmo no simulador completo (cerca de 35 s)
npm run avaliar      # 10 sementes de 1 dia, com ganho médio e variação (cerca de 25 s)
```

Opções do `avaliar`:

```bash
node tools/avaliar.js --sementes=20 --passos=5760        # 20 sementes, 2 dias
node tools/avaliar.js --kz=0 --kt=0                      # sem compartilhar o aprendizado
node tools/avaliar.js --evento=chuva,greve               # cenários
node tools/avaliar.js --pausar=0,3                       # campanhas pausadas
node tools/avaliar.js --acc=0.6 --rest=0 --forget=1      # câmera, desgaste, esquecimento
node tools/avaliar.js --corrige=0 --estima=0             # comportamento anterior ao desgaste estimado
node tools/avaliar.js --contexto=1 --horario=3           # período do dia como contexto, com o horário pesando 3 vezes mais
node tools/avaliar.js --desgaste=2.5                     # desgaste do mundo 2,5 vezes maior
```

`tools/headless.js` carrega os mesmos arquivos de `site/js` que o navegador usa (`util`, `config`, `world`, `brain` e `sim`) e roda o mundo, o Brain, a rotação fixa e o oráculo sem interface. Um dia simulado leva cerca de 2,5 s.

## No site

A seção **Variação entre sementes**, abaixo do painel da rede, faz o mesmo no navegador: roda 5, 10 ou 20 cidades novas (sementes 1 a N) de 6 horas a 2 dias, com os parâmetros, cenários e campanhas de agora. Mostra o ganho médio, o intervalo de 95%, o desvio, o menor e o maior ganho, um gráfico com um ponto por semente, a tabela completa e um botão para copiar o CSV.

- A simulação ao vivo fica parada durante a execução e volta exatamente como estava. Dá para cancelar.
- 10 sementes de 1 dia levam cerca de 20 a 30 segundos.
- As sementes são as mesmas de `npm run avaliar`, mas os números não batem dígito por dígito: a mesma semente reproduz o mesmo dia só no mesmo ambiente. Entre o Node e o navegador, as primeiras centenas de spots coincidem e depois as trajetórias se afastam, por diferenças de arredondamento das funções matemáticas. Em média os resultados concordam: com 10 sementes de 1 dia, o ganho foi de 24,0% no navegador e de 24,1% no Node.

## Resultado de referência

10 sementes, 1 dia simulado cada (a partir das 06:00 de segunda), parâmetros padrão:

| Medida | Média | Desvio | Mín | Máx |
|---|---|---|---|---|
| Ganho sobre a rotação fixa | 24,1% | 1,1 ponto | 22,6% | 26,1% |
| Eficiência do algoritmo (% do oráculo) | 93,8% | 0,9 ponto | 92,4% | 95,0% |
| Eficiência da rotação fixa | 75,6% | 0,6 ponto | 74,8% | 76,8% |
| Perfis com o melhor criativo certo (de 8) | 7,5 | 0,7 | 6 | 8 |

O ganho médio tem intervalo de 95% de 23,4% a 24,8%. Antes da issue 5 (`--corrige=0 --estima=0`), as mesmas 10 sementes davam 22,9% de ganho, 92,9% de eficiência e 7,7 perfis certos. A variação entre sementes é pequena porque os 42 totens e cerca de 520 mil olhares por dia dão muita amostra.

## O que os testes garantem

- A mesma semente reproduz exatamente o mesmo dia, no mesmo ambiente, e rodar sementes em sequência não deixa estado de uma na outra.
- O algoritmo supera a rotação em todas as sementes (pior caso acima de 10%, média acima de 15%).
- A eficiência do algoritmo fica acima de 85% e pelo menos 8 pontos acima da rotação.
- O algoritmo descobre o melhor criativo de quase todos os perfis, e acerta bem mais depois de um dia do que depois de uma hora.
- Compartilhar o aprendizado entre totens e zonas aumenta o ganho nas primeiras 6 horas em mais de 5 pontos.
- O ganho se mantém nos cenários de chuva, show, greve e feriado, com câmera de 60% de acerto, e com campanhas pausadas.
- Corrigir e estimar o desgaste supera o comportamento anterior em todas as sementes testadas, e o r̂ de cada totem tem correlação acima de 0,6 com o real.
- Quando o horário pesa 3 vezes mais, o contexto de período do dia aumenta o ganho em todas as sementes testadas.
- Parâmetros extremos (priors zerados, esquecimento nulo, desgaste de 0 a 1) não geram valores inválidos.

Os limites dos testes ficam bem abaixo das medidas acima, para pegar regressões sem quebrar por ruído. Foi verificado que desligar o aprendizado derruba 6 desses testes.

## O que a avaliação mostrou

Os números de sensibilidade abaixo usam 6 sementes e foram medidos uma vez, sem intervalo de confiança. Diferenças de menos de 1 ponto não são conclusivas.

**Aprendizado ao longo do tempo.** Acertos do melhor criativo por perfil (média de 5 sementes, de 8 perfis): 2,6 em 10 min, 3,6 em 30 min, 4,6 em 1 h, 5,4 em 2 h, 6,4 em 6 h e 7,7 em 1 dia.

**Compartilhar o aprendizado importa muito no começo.** Nas primeiras 6 horas, o ganho sobre a rotação cai de 18,5% para 8,1% quando os priors de zona e de rede são zerados (`kz=0, kt=0`). Num dia inteiro o ganho sem compartilhar é de 14,7%, contra 22,9% com o padrão: a diferença encolhe, mas continua grande.

**O desgaste assumido não ajudava, e a causa era dupla contagem.** Antes da issue 5, as contagens aprendidas já traziam o desgaste embutido (uma interação num criativo cansado valia 1, mesmo sendo mais rara), e o algoritmo ainda multiplicava a taxa por um desgaste genérico (r̂ = 0,4). Ignorar o desgaste (`rest=0`) dava 23,4% contra 22,9%.

A issue 5 trocou isso por duas peças, ligadas por padrão (`corrige` e `estima`):

- **Aprendizado corrigido.** Cada interação vale 1/f nas contagens, e as contagens passam a medir a taxa sem desgaste.
- **Desgaste estimado por totem.** O algoritmo ajusta r̂ de cada totem aos dados: média a posteriori numa grade de 0 a 2, com verossimilhança de Bernoulli sobre a taxa da rede e prior centrado em 0,4.

Medido em 12 sementes novas, pareadas com o comportamento anterior (diferença em pontos percentuais de ganho, com erro padrão):

| Desgaste do mundo | Corrigir e estimar | Só corrigir |
|---|---|---|
| normal | +1,36 ± 0,31 | +1,13 ± 0,24 |
| 2,5 vezes maior | +0,84 ± 0,12 | +0,64 ± 0,15 |

Quase todo o ganho vem de corrigir o aprendizado. A estimativa por totem soma cerca de 0,2 ponto.

**O espaço de melhora do desgaste é pequeno neste mundo.** Dar ao algoritmo o r verdadeiro de cada totem (um teste com trapaça, 4 sementes) rende ganho de 24,4% contra 23,1% do comportamento anterior, ou seja, no máximo cerca de 1,3 ponto. O estimador chega a esse teto. Ele não faz milagre: a estação, a zona de mais repetição, já estava em 93% do oráculo e continua igual. Os ganhos aparecem onde o desgaste verdadeiro é baixo (noite de 92% para 97% do oráculo, bairro de 90% para 93%), porque o r̂ genérico de 0,4 penalizava criativos que ainda rendiam.

**Quão bem o desgaste é estimado.** A correlação entre r̂ e o r verdadeiro dos totens é 0,31 depois de 6 horas e 0,83 a 0,89 depois de 1 a 3 dias. O erro médio absoluto é de 0,13, contra 0,16 de usar 0,4 em todos. O estimador acerta a ordem dos totens melhor do que o valor absoluto, e nas primeiras horas ele ainda não sabe nada.

**O desgaste por criativo não foi implementado.** No mundo simulado o desgaste varia por totem, não por criativo. Estimar uma diferença que não existe não pode ser verificado. Para isso, o primeiro passo seria dar a cada criativo uma taxa de desgaste própria no mundo simulado.

**O período do dia vale pouco neste mundo, e muito quando o horário pesa.** A issue 4 acrescentou um contexto opcional de período do dia (`contexto=1`): um multiplicador por criativo e por período de 3 h (8 períodos), comum a toda a rede, com média 1 por criativo. Cada interação passa a valer 1/(f·m) nas contagens, para que elas meçam a taxa sem desgaste e sem efeito do horário. Não foi testada a alternativa de ter um conjunto de contagens inteiro por período.

Diferença de ganho sobre a rotação com o contexto ligado, em pontos percentuais, com erro padrão, pareada por semente:

| Efeito do horário no mundo | Contexto estimado | Se o algoritmo conhecesse o efeito exato |
|---|---|---|
| padrão (8 sementes) | +0,14 ± 0,32 | +0,55 ± 0,25 |
| 2 vezes maior (6 sementes) | +0,90 ± 0,20 (todas positivas) | +1,43 ± 0,18 |
| 3 vezes maior (6 sementes) | +2,22 ± 0,30 (todas positivas) | +1,77 ± 0,17 |

No mundo padrão o efeito do horário é suave (no máximo 1,5 vez a taxa, num pico de 1 a 3 h), então a escolha do criativo quase nunca muda por causa dele: o espaço de melhora é de cerca de 0,5 ponto e o contexto não o alcança de forma mensurável. Nas 10 sementes de referência, o ganho foi de 24,1% sem o contexto e 23,9% com ele, e os perfis com o melhor criativo certo caíram de 7,5 para 7,1. Por isso o contexto vem **desligado por padrão**. Quando o efeito do horário é maior, o ganho aparece em todas as sementes. A coluna da direita é uma aproximação (efeito médio de cada período), por isso o estimado pode passar dela.

Para ligar: `contexto` no menu Cálculos > Parâmetros, ou `node tools/avaliar.js --contexto=1 --horario=3`. Só vale ligar se houver evidência, nos dados reais, de que a resposta aos criativos muda com o horário.

**Esquecer não ajudou dentro de 1 dia.** Com `forget=1` (nunca esquece) o ganho foi de 23,5%. O mundo simulado não muda de verdade ao longo do dia, então esquecer só descarta dados. Em um mundo que muda, o resultado pode ser outro.

**Câmera ruim custa pouco.** Com 60% de acerto na faixa etária, o ganho foi de 21,8%.

## Limites

- O mundo simulado é o mesmo em que o algoritmo foi desenvolvido. Os números provam que o algoritmo funciona nele, e não que funcionará em campo.
- O oráculo é guloso e antecipa o desgaste só em parte, então a eficiência pode passar de 100% em trechos curtos.
- Um dia simulado não cobre fim de semana nem mudanças de longo prazo. Use `--passos=20160` (7 dias) para isso.
