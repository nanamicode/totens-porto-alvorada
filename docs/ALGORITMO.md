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
- A recompensa é a interação imediata (toque ou QR). Conversões com atraso não são tratadas.
- O oráculo é guloso e antecipa o desgaste só em parte, então a eficiência pode passar de 100%.
