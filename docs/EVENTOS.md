# Formato de evento do totem

Este documento define o que um totem envia ao fim de cada spot. É o contrato entre o totem (ou o sistema que o controla) e o algoritmo. A versão atual é a **1**.

- Formato formal: [evento-spot.schema.json](evento-spot.schema.json) (JSON Schema).
- Validador em código: `site/js/eventos.js` (`Eventos.validar`), que roda no navegador e no Node.
- Exemplos: [exemplos/eventos-exemplo.jsonl](exemplos/eventos-exemplo.jsonl) (120 eventos de um totem) e [exemplos/registro-exemplo.json](exemplos/registro-exemplo.json) (cadastro).

## Princípios

- **Só contagens agregadas.** O evento não leva imagem, vídeo, rosto, identificador de pessoa nem de aparelho. A câmera do totem estima o perfil de quem olha e descarta a imagem no próprio totem.
- **Perfil é estimativa.** Gênero e faixa etária vêm de um classificador que erra. O algoritmo já considera isso: no simulador a câmera erra o perfil de 14% das pessoas, na faixa etária ou no gênero.
- **Um evento por spot, sempre.** Spots sem ninguém olhando também são enviados, com todas as contagens em zero. O algoritmo usa isso para saber quanto cada criativo foi exibido.
- **Idempotente.** O campo `spot` é único. Quem recebe descarta duplicatas pelo `spot`.

## O evento `spot`

Enviado ao fim de cada spot, em JSON.

| Campo | Tipo | Descrição |
|---|---|---|
| `versao` | inteiro | Sempre `1`. |
| `tipo` | texto | Sempre `"spot"`. |
| `totem` | texto | Identificador do totem, como `T-25`. Igual ao do cadastro de totens. |
| `spot` | texto | Identificador único do spot. O simulador usa o totem e o início, como `T-25-20260105T070130`. |
| `inicio` | texto | Início do spot, em ISO 8601 **com fuso**, como `2026-01-05T07:01:30-03:00`. A hora local é o que importa para o contexto de horário. |
| `duracao_s` | número | Duração do spot em segundos. No simulador, 30. |
| `criativo` | texto | Identificador do criativo exibido, como `brasa-cafe`. Igual ao do cadastro de criativos. |
| `audiencia` | objeto | Pessoas que olharam para a tela durante o spot, por perfil. |
| `interacoes` | objeto ou inteiro | Toques ou leituras de QR atribuídos ao spot. Veja [atribuição](#atribuição-das-interações). |

### Perfis

Os 8 perfis são o cruzamento de 2 gêneros estimados com 4 faixas etárias. Todos os 8 aparecem sempre, mesmo com zero.

| Perfil | Significado |
|---|---|
| `H18-24`, `H25-34`, `H35-49`, `H50+` | homens, por faixa etária |
| `M18-24`, `M25-34`, `M35-49`, `M50+` | mulheres, por faixa etária |

### Exemplo

```json
{
  "versao": 1,
  "tipo": "spot",
  "totem": "T-25",
  "spot": "T-25-20260105T070130",
  "inicio": "2026-01-05T07:01:30-03:00",
  "duracao_s": 30,
  "criativo": "brasa-cafe",
  "audiencia":  { "H18-24": 0, "H25-34": 1, "H35-49": 2, "H50+": 2, "M18-24": 2, "M25-34": 2, "M35-49": 2, "M50+": 1 },
  "interacoes": { "H18-24": 0, "H25-34": 0, "H35-49": 1, "H50+": 0, "M18-24": 0, "M25-34": 0, "M35-49": 0, "M50+": 0 }
}
```

Em transmissão em lote, use JSON Lines: um evento por linha, sem quebra dentro do evento.

## Atribuição das interações

O algoritmo aprende a taxa de interação de cada perfil, então precisa saber **quem** interagiu. Um totem real nem sempre sabe. O formato aceita os dois casos:

- **Por perfil** (`interacoes` é um objeto com os 8 perfis). Vale quando o totem associa o toque na tela à pessoa à frente dele. É o que o simulador gera. Cada perfil deve ter no máximo tantas interações quanto pessoas em `audiencia`.
- **Por spot** (`interacoes` é um inteiro com o total). Vale quando só se sabe que houve a interação, como na leitura de um QR em outro aparelho, ligada ao spot por um endereço curto. Aqui o perfil de quem interagiu é desconhecido.

> **Interações só por spot.** O Operador ([OPERACAO.md](OPERACAO.md)) reparte o total entre os perfis presentes, ajustando a taxa de cada perfil por mínimos quadrados online. Aprende bem mais devagar que por perfil nas primeiras horas: os números estão em [OPERACAO.md](OPERACAO.md#quanto-o-formato-só-total-custa). O simulador gera sempre por perfil, o que é otimista em relação a um totem só com QR.

## Regras de qualidade

`Eventos.validar` aplica estas regras e devolve erros (o evento deve ser rejeitado) e avisos (o evento é aceito, mas é suspeito).

Erros:
- Falta algum campo, ou há campo desconhecido.
- `versao` diferente de 1, ou `tipo` diferente de `"spot"`.
- `totem` fora do padrão `T-01`, ou `criativo` fora do padrão `brasa-cafe`.
- `inicio` que não seja data e hora ISO 8601 com fuso.
- `duracao_s` menor ou igual a zero.
- Contagens que não sejam inteiros maiores ou iguais a zero, ou que não tenham exatamente os 8 perfis.
- Interações por perfil maiores que a audiência do mesmo perfil.

Avisos:
- Total de interações por spot maior que o total de pessoas contadas.

O que o validador **não** confere, e que quem recebe deve tratar:
- **Relógio do totem.** O `inicio` confia no relógio do totem. Relógio errado distorce o contexto de horário.
- **Spots faltando.** Um totem offline não envia eventos, e isso não deve ser lido como "ninguém passou".
- **Ordem.** Os eventos podem chegar fora de ordem. O `inicio` é a referência, não a hora de chegada.

## Cadastros

Os eventos citam totens e criativos só por identificador. O significado fica em dois cadastros, mantidos à parte.

```json
{
  "totens":    [ { "id": "T-25", "nome": "Plataforma Norte", "zona": "estacao" } ],
  "criativos": [ { "id": "brasa-cafe", "nome": "Brasa Café" } ]
}
```

A `zona` agrupa totens parecidos: o algoritmo compartilha o aprendizado entre os totens da mesma zona, então ela precisa estar no cadastro. O simulador gera o cadastro com `npm run eventos -- --registro`.

## Como o algoritmo usa o evento

| Parte do evento | Uso no algoritmo |
|---|---|
| `audiencia` | Contagem de olhares por perfil. Vira as tentativas do aprendizado. |
| `interacoes` | Sucessos por perfil. Vira o que o algoritmo aprende. |
| `criativo` e a soma de `audiencia` | Exposição do criativo no totem, para estimar o desgaste. |
| `inicio` | Período do dia, quando o contexto de horário está ligado. |
| `totem` e o cadastro | Totem e zona do aprendizado. |

O evento **fecha o ciclo depois do spot**. A decisão do próximo criativo também precisa de uma leitura em tempo real: quem está à frente do totem agora. Essa leitura não é um evento de spot: o totem a envia na hora de decidir, pela rota `/decidir` do Operador ([OPERACAO.md](OPERACAO.md)).

## Como gerar eventos do simulador

- No site: menu Cálculos, aba **Eventos**. Mostra os últimos eventos, diz se todos são válidos e copia em JSON Lines.
- Pelo terminal:

```bash
npm run eventos -- --semente=1 --passos=240 --totem=T-25 --ultimos=120 > eventos.jsonl
npm run eventos -- --registro > registro.json
```

Os testes garantem que os eventos do simulador são válidos, que somam exatamente os olhares e as interações do algoritmo, e que dá para recriar o aprendizado do algoritmo só a partir dos eventos e do cadastro.

## O que ainda não está no formato

- **Conversões com atraso** (a compra depois da interação). Seria um segundo tipo de evento, ligado ao `spot` de origem. Fica para a issue de recompensa com atraso.
- **Campanhas e metas de entrega.** O evento não diz a qual campanha o criativo pertence.
- **Qualidade da câmera.** Não há campo para a confiança do classificador nem para falhas do sensor.
