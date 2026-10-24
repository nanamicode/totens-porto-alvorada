# Algoritmo

## Mundo simulado (o que o algoritmo não vê)

```
fluxo:     N ~ Poisson( escala × 13 × (perfil_zona(hora, fim de semana) + 0,03) × evento )
perfil:    w_s ∝ idade_zona × modificador_hora × gênero_zona        s = gênero × faixa etária (8 perfis)
câmera:    acerta a faixa etária com prob. 86%; erra para a faixa vizinha (75% dos erros) ou troca o gênero
taxa real: p = base_c × afin_idade × afin_gênero × afin_zona × afin_hora        (máx. 9%)
           afin_hora vai de 1 a no máximo 1,5, num pico de 1 a 3 h por criativo
desgaste:  f = 0,35 + 0,65·exp(−r·E / 600)       E = olhares recentes do criativo no totem, meia-vida de 150 min
interação: u ~ U(0,1);  interagiu ⇔ u < p × f
```

## Cérebro: Thompson Sampling contextual hierárquico

```
contexto:    perfil estimado pela câmera de cada pessoa em frente à tela
prior rede:  μ_rede = (a_rede + 0,2) / (n_rede + 10)
prior zona:  μ_zona = (a_zona + K_zona·μ_rede) / (n_zona + K_zona)          K_zona = 40
posterior:   a = a_totem + K_totem·μ_zona
             b = (n_totem − a_totem) + K_totem·(1 − μ_zona)                 K_totem = 60
amostra:     θ_s,c ~ Beta(a, b)          (aproximação normal quando a + b > 60)
audiência:   score_c = ( Σ_s n_s·θ_s,c / N ) × f̂_c
             f̂_c = 0,35 + 0,65·exp(−r̂_totem·E_c / 600)
decisão:     c* = argmax_c score_c
aprendizado: n[s,c*] += 1;  a[s,c*] += 1/f̂ se interagiu   (totem, zona e rede)
desgaste:    r̂_totem = média a posteriori de r numa grade de 0 a 2,
             prior centrado em 0,4, verossimilhança Π Bernoulli( interagiu | μ_rede(s,c)·f(E; r) )
horário:     opcional (contexto=1). score_c leva ainda o fator m_c,p, e a contagem usa 1/(f̂·m)
             m_c,p = (H_c,p + 10) / (X_c,p + 10), normalizado para média 1 por criativo, em 8 períodos de 3 h
             H = interações corrigidas pelo desgaste, X = interações que a taxa média da rede previa
memória:     a, n ×= 0,985 a cada hora
```

## Conversão com atraso

Por padrão a recompensa é a interação imediata (toque ou QR). Com `atraso` maior que zero (minutos), a recompensa passa a ser a **conversão**, que chega depois:

```
mundo:        uma interação do criativo c converte com chance cv_c (de 10% a 45%) e a conversão chega d spots depois,
              d ~ exponencial com média atraso × 2 × dl_c  (dl_c = 0,3 a 3: cinema converte rápido, cartão devagar)
algoritmo:    "interagiu" passa a ser "converteu". Dois jeitos de lidar com o que ainda não chegou (parâmetro espera):
  espera = 0  o olhar entra na hora como falha (n += 1) e, quando a conversão chega, soma só o acerto (a += 1/f̂ · brain.credit)
  espera = k  o olhar e o resultado entram juntos (brain.learnLote) k × atraso depois da exibição; conversão que chega depois não conta
  nos dois, o desgaste usado é o da hora da exibição, não o de quando o resultado chega
oráculo:      passa a maximizar interações × cv_c
```

Com `atraso = 0` nada disso roda e o resultado é idêntico ao de antes. `Brain` oferece `learn`/`learnLote` com `eSnap` (a exposição na hora da exibição) e `credit`. O operador recebe conversões atrasadas pelo evento `conversao` ([OPERACAO.md](OPERACAO.md#aprender-com-conversões)), sempre no modo `espera = 0` (olhar como falha na hora, acerto quando chega).

## Criativo novo no meio da operação

O oitavo criativo (Orla Sorvetes) fica reservado: sem o botão **Lançar criativo novo** ele não é exibido por ninguém e não aparece nas tabelas. Ao lançar, ele entra com a rede operando e **sem nenhuma contagem aprendida**: o algoritmo só o conhece pelo prior (taxa média da rede, com peso K_zona e K_totem), e a amostragem de Thompson cuida da exploração.

```
testado:   metade dos totens já o exibiu pelo menos uma vez
adotado:   numa janela de 30 min, o algoritmo o exibe em pelo menos 80% dos spots em que o oráculo o exibe
           (e o oráculo o exibe em pelo menos 30 spots da janela; senão não há o que adotar)
qualidade: o parâmetro qnovo multiplica a taxa verdadeira do criativo no momento do lançamento (1 = bom, 0,3 = fraco)
```

O lançamento é uma mudança do tipo `campanha` com índice 7, então entra nos cenários salvos e se refaz igual. Uma cidade nova (Reiniciar) volta sem o criativo lançado. Medição em `tools/lancar.js`.

## Metas de entrega por anunciante

Cada campanha tem uma **meta de olhares por dia** e um **orçamento por dia** (R$; a 18 R$ por mil olhares, 10% acima do custo da meta). Elas valem para o algoritmo, a rotação e o oráculo na hora de medir. O cumprimento é a parte da meta que foi entregue, até o limite da meta, somada nos dias completos (a cidade começa às 06:00, então o primeiro dia não conta). O criativo reservado não tem meta.

Com `ritmo` maior que zero o operador passa a **equilibrar desempenho e entrega**: dá a cada campanha um peso na escolha do algoritmo, que multiplica o valor esperado de cada criativo (`Brain.create({peso})`; 0 tira a campanha da escolha):

```
ρ = (fração da meta que falta) ÷ (fração do tráfego do dia que falta)       1 = no ritmo, acima de 1 = atrasada, abaixo = adiantada
peso = ρ^ritmo, entre 0,2 e 3
orçamento do dia esgotado (olhares entregues ≥ orçamento ÷ preço por mil) = peso 0 até a meia-noite
tráfego do dia que falta: usa o total do último dia completo; no primeiro dia, supõe que as metas somam 80% da capacidade
```

Com `ritmo = 0` (padrão) os pesos valem 1 e o resultado é idêntico ao de antes. `metaEsc` multiplica todas as metas e orçamentos. Medição em `tools/metas.js`. O peso entra só na escolha: o aprendizado continua medindo o desempenho de cada criativo, sem o peso.

## Referências e métrica

```
rotação fixa: campanha ativa número (spot + 3·totem) mod nº de ativas
oráculo:      argmax_c Σ_s n_s,real·p_s,c × f(E_c + λ·16), com a audiência e a taxa verdadeiras
eficiência:   Σ interações_política / Σ interações_oráculo, janela móvel de 3 h
ganho:        interações_algoritmo / interações_rotação − 1
```

## Hipóteses a validar com dados reais

- O desgaste é estimado por totem. Por criativo ainda não, porque o mundo simulado não tem desgaste próprio de cada criativo.
- O período do dia como contexto é opcional e vem desligado: no mundo simulado padrão o efeito do horário é pequeno e o contexto não ajuda de forma mensurável. Com o horário pesando 2 a 3 vezes mais, ele ajuda em todas as sementes.
- A recompensa é a interação imediata (toque ou QR), a não ser que o atraso de conversão esteja ligado (veja acima). O atraso do mundo simulado é exponencial: o real pode ter outra forma.
- O oráculo é guloso e antecipa o desgaste só em parte, então a eficiência pode passar de 100%.
