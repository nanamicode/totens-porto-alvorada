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
```

`tools/headless.js` carrega os mesmos arquivos de `site/js` que o navegador usa (`util`, `config`, `world`, `brain` e `sim`) e roda o mundo, o Brain, a rotação fixa e o oráculo sem interface. Um dia simulado leva cerca de 2,5 s.

## Resultado de referência

10 sementes, 1 dia simulado cada (a partir das 06:00 de segunda), parâmetros padrão:

| Medida | Média | Desvio | Mín | Máx |
|---|---|---|---|---|
| Ganho sobre a rotação fixa | 22,9% | 0,8 ponto | 21,8% | 24,0% |
| Eficiência do algoritmo (% do oráculo) | 92,9% | 0,6 ponto | 92,2% | 93,9% |
| Eficiência da rotação fixa | 75,6% | 0,6 ponto | 74,8% | 76,8% |
| Perfis com o melhor criativo certo (de 8) | 7,7 | 0,5 | 7 | 8 |

O ganho médio tem intervalo de 95% de 22,4% a 23,4%. A variação entre sementes é pequena porque os 42 totens e cerca de 520 mil olhares por dia dão muita amostra.

## O que os testes garantem

- A mesma semente reproduz exatamente o mesmo dia.
- O algoritmo supera a rotação em todas as sementes (pior caso acima de 10%, média acima de 15%).
- A eficiência do algoritmo fica acima de 85% e pelo menos 8 pontos acima da rotação.
- O algoritmo descobre o melhor criativo de quase todos os perfis, e acerta bem mais depois de um dia do que depois de uma hora.
- Compartilhar o aprendizado entre totens e zonas aumenta o ganho nas primeiras 6 horas em mais de 5 pontos.
- O ganho se mantém nos cenários de chuva, show, greve e feriado, com câmera de 60% de acerto, e com campanhas pausadas.
- Parâmetros extremos (priors zerados, esquecimento nulo, desgaste de 0 a 1) não geram valores inválidos.

Os limites dos testes ficam bem abaixo das medidas acima, para pegar regressões sem quebrar por ruído. Foi verificado que desligar o aprendizado derruba 6 desses testes.

## O que a avaliação mostrou

Os números de sensibilidade abaixo usam 6 sementes e foram medidos uma vez, sem intervalo de confiança. Diferenças de menos de 1 ponto não são conclusivas.

**Aprendizado ao longo do tempo.** Acertos do melhor criativo por perfil (média de 5 sementes, de 8 perfis): 2,6 em 10 min, 3,6 em 30 min, 4,6 em 1 h, 5,4 em 2 h, 6,4 em 6 h e 7,7 em 1 dia.

**Compartilhar o aprendizado importa muito no começo.** Nas primeiras 6 horas, o ganho sobre a rotação cai de 18,5% para 8,1% quando os priors de zona e de rede são zerados (`kz=0, kt=0`). Num dia inteiro o ganho sem compartilhar é de 14,7%, contra 22,9% com o padrão: a diferença encolhe, mas continua grande.

**O desgaste assumido não ajudou.** Com `rest=0` (o algoritmo ignora o desgaste por repetição) o ganho foi de 23,4%, contra 22,9% com o padrão, e com `rest=1` caiu para 21,6%. No simulador, a variação natural do Thompson Sampling já alterna os criativos. Isso pede revisão na issue de estimar o desgaste por totem.

**Esquecer não ajudou dentro de 1 dia.** Com `forget=1` (nunca esquece) o ganho foi de 23,5%. O mundo simulado não muda de verdade ao longo do dia, então esquecer só descarta dados. Em um mundo que muda, o resultado pode ser outro.

**Câmera ruim custa pouco.** Com 60% de acerto na faixa etária, o ganho foi de 21,8%.

## Limites

- O mundo simulado é o mesmo em que o algoritmo foi desenvolvido. Os números provam que o algoritmo funciona nele, e não que funcionará em campo.
- O oráculo é guloso e antecipa o desgaste só em parte, então a eficiência pode passar de 100% em trechos curtos.
- Um dia simulado não cobre fim de semana nem mudanças de longo prazo. Use `--passos=20160` (7 dias) para isso.
