# Totens de Porto Alvorada

Simulador de uma rede de totens digitais de mídia exterior (OOH) numa cidade fictícia. Cada totem conta quem passa, escolhe o criativo certo para aquele público e aprende com as interações. Todos os dados são sintéticos.

O objetivo é validar, com dados simulados, um algoritmo que depois possa rodar em totens reais.

## Como rodar

Não precisa instalar nada. Abra `site/index.html` no navegador.

Para servir localmente:

```bash
python -m http.server 8000 --directory site
```

Depois acesse http://localhost:8000.

## O que o simulador mostra

- **A cidade:** 42 totens em 7 zonas (campus, centro, comércio, bairro, estação, orla e noite), com pessoas andando. O fluxo e o perfil (gênero e faixa etária) mudam com o horário e com o dia da semana.
- **O algoritmo:** Thompson Sampling contextual e hierárquico, comparado com uma rotação fixa e com um oráculo que conhece a verdade.
- **Menu Cálculos:** cada número do aprendizado de máquina, passo a passo, para o totem selecionado.
- **Cenários:** chuva, show, greve e feriado.
- **Campanhas:** pausar e retomar criativos.
- **Painel de anunciantes:** custo por interação e retorno estimado.

## Como o algoritmo decide

A cada spot de 30 s o totem:

1. Conta as pessoas à frente e estima o perfil de cada uma por câmera (com erro).
2. Para cada perfil e criativo, sorteia uma taxa de interação de uma distribuição Beta. A distribuição combina o que a rede, a zona e o totem já aprenderam.
3. Pesa o resultado pela audiência da tela e desconta o desgaste por repetição.
4. Exibe o criativo de maior pontuação e atualiza as contagens com as interações.

As fórmulas completas ficam na aba Fórmulas do menu Cálculos e em [docs/ALGORITMO.md](docs/ALGORITMO.md).

O algoritmo só usa o que um totem real teria: contagem, perfil estimado e interações. Ele nunca lê a taxa verdadeira, a zona ou o horário.

## Estrutura

```
site/index.html                 simulador completo, em um único arquivo
prototipo/bandit_criativos.py   primeiro protótipo em Python, sem interface
docs/ALGORITMO.md               fórmulas e hipóteses
docs/ROADMAP.md                 próximos passos
```

## Privacidade

Num uso real, o sistema deve só contar pessoas e estimar faixa etária e gênero de forma agregada, sem reconhecer rostos nem guardar imagens, em linha com a LGPD. Isso precisa de revisão jurídica antes de qualquer instalação.

## Estado do projeto

Protótipo. O mundo simulado, o desgaste e as taxas de interação são suposições, não medições. Veja o [roadmap](docs/ROADMAP.md).
