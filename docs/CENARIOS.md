# Cenários: salvar e carregar

Um **cenário** guarda uma sessão do simulador de um jeito que dá para refazê-la do zero e chegar ao mesmo ponto: a semente, a configuração inicial e tudo o que foi mudado pelo caminho. Serve para repetir um teste, mandar um caso para outra pessoa ou comparar duas versões do algoritmo na mesma situação.

## Como usar

**No site**, na seção **Cenários**:
- **Salvar cenário atual** guarda a cidade como está e mostra o JSON, com botões para copiar o JSON ou um **link**. O link leva o cenário no endereço (`#cenario.…`) e cabe quando o histórico é pequeno; se ficar grande demais, use o JSON.
- **Carregar** aceita o JSON, um link ou um dos exemplos. **Reproduzir até o ponto salvo** refaz a sessão do zero, passo a passo, com barra de progresso e botão de cancelar. **Só a configuração, recomeçando** aplica a configuração inicial e começa uma cidade nova com a mesma semente, parada no passo 0.
- Ao abrir um link com `#cenario.…`, o cenário já vem preenchido na caixa de carregar. Ele **não roda sozinho**: confira e aperte Reproduzir.
- Quando o cenário traz números salvos, o site confere os olhares e as interações depois de refazer, e diz se bateram.

**No terminal**:

```bash
npm run cenario -- docs/exemplos/cenario-exemplo.json                         # refaz e confere
npm run cenario -- --novo --semente=2 --passos=1440 --evento=chuva --nome="Chuva forte" > cenario.json
```

Códigos de saída ao refazer: 0 refeito (e conferido, se havia números), 2 arquivo inválido, 4 números diferentes dos salvos.

## O formato

```json
{
 "versao": 1,
 "nome": "Greve às 9h e uma campanha pausada à tarde",
 "semente": 3,
 "passos": 1440,
 "config0": { "params": { "kz": 40 }, "eventos": { "chuva": false }, "campanhasPausadas": [] },
 "mudancas": [
  { "passo": 360, "tipo": "evento", "chave": "greve", "valor": true },
  { "passo": 720, "tipo": "campanha", "chave": 0, "valor": false }
 ],
 "resultado": { "olhares": 302813, "interacoes": [10455, 8464, 11079] }
}
```

| Campo | O que é |
|---|---|
| `versao` | Sempre 1. |
| `nome` | Texto livre, até 80 letras. Opcional. |
| `semente` | Inteiro de 0 a 4.294.967.295. Define a cidade e todo o sorteio. |
| `passos` | Quantos spots de 30 s a sessão tem (de 0 a 43.200, ou 15 dias). 120 passos são 1 hora. |
| `config0` | A configuração quando a cidade foi criada: `params` (parâmetros do algoritmo e da câmera), `eventos` (chuva, show, greve, feriado) e `campanhasPausadas` (índices de 0 a 6). **O que não vier volta ao padrão.** |
| `mudancas` | O que foi mudado depois, em ordem: `passo` (em que passo aconteceu), `tipo` (`param`, `evento` ou `campanha`), `chave` e `valor`. No máximo 2.000. A campanha de índice 7 é o criativo novo: `{ "tipo": "campanha", "chave": 7, "valor": true }` é o lançamento (veja docs/ALGORITMO.md). |
| `resultado` | Opcional. Olhares e as 3 contagens de interações (algoritmo, rotação, oráculo) no ponto salvo, para conferir. |

Quem valida é `Cenario.validar` (`site/js/cenario.js`), e cada erro diz o que está errado.

## Como a reprodução funciona

Refazer é `reproduzirPassos` (`site/js/sim.js`): aplica `config0`, cria a cidade com a semente e roda `passos` passos. Antes de rodar o passo *k*, aplica as mudanças com `passo ≤ k`; as do último passo valem para o estado final. Como o simulador sorteia tudo a partir da semente, a sessão fica igual.

A tela registra as mudanças que passam por ela: ligar ou desligar um cenário, pausar ou retomar uma campanha e mexer num parâmetro do menu Cálculos. Arrastar um controle conta como **uma** mudança (a última). A cidade nova do botão Reiniciar tem a própria semente e o próprio histórico.

Para isso valer, **o desenho do mapa deixou de usar o sorteio da simulação**. Antes, as pessoas que andam no mapa sorteavam com o mesmo gerador do mundo, e o resultado dependia de quando a tela era pintada.

## Limites

- **Só reproduz o mesmo dia no mesmo ambiente.** Entre o Node e um navegador, ou entre dois navegadores diferentes, as primeiras centenas de spots coincidem e depois as trajetórias se afastam, por diferenças de arredondamento das funções matemáticas. Um cenário salvo num ambiente e refeito em outro **roda e chega a um resultado parecido, mas os números salvos não batem**, e o site e o comando dizem isso. Refeito no mesmo navegador, bateu exatamente nos meus testes.
- **Nem tudo entra.** Ficam de fora a velocidade, o modo e a vista do mapa (2D ou 3D), o totem selecionado, as abas do menu e as opções do mundo usadas só na comparação e na avaliação (efeito do horário e desgaste do mundo maiores). Também não entra o que `Cenario.validar` não reconhece: o formato só conhece os parâmetros, os cenários e as campanhas listados.
- **O tempo cresce com os passos.** Um dia simulado leva cerca de 3 segundos no navegador; 15 dias, perto de 45.
- **Uma versão diferente do simulador pode dar outro resultado**, porque o formato guarda a configuração, não o código. O campo `versao` serve para mudar o formato, não o algoritmo.
- **Links grandes.** O endereço guarda até cerca de 6.000 letras do cenário codificado. Acima disso, só o JSON.
