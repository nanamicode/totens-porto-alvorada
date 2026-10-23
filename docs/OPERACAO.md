# Operação com totens reais

O **Operador** liga o algoritmo (o `Brain`) aos eventos de um totem real. Ele recebe os eventos de spot ([EVENTOS.md](EVENTOS.md)) e as leituras em tempo real, e responde qual criativo exibir. Roda em Node, sem instalar nada, e também no navegador.

> **Estado do protótipo.** Só foi testado com o simulador, nunca com um totem de verdade. O servidor é um protótipo: não tem criptografia, e a única proteção é um token opcional. Leia os [limites](#limites) antes de qualquer instalação.

## O ciclo de um totem

1. **Antes de cada spot**, o totem lê quem está à frente (a contagem por perfil que a câmera estima) e pergunta `POST /decidir`. A resposta traz o criativo.
2. **Durante o spot**, o totem exibe o criativo e conta olhares e interações.
3. **Depois do spot**, o totem envia o evento `POST /evento`. O algoritmo aprende com ele.

O totem precisa guardar o último criativo recebido e continuar exibindo algo se o servidor não responder. O Operador não cuida disso.

## Rodar o servidor

```bash
npm run servidor -- --estado=estado.json
```

| Opção | O que faz |
|---|---|
| `--cadastro=ARQ` | Cadastro de totens e criativos. Padrão: `docs/exemplos/registro-exemplo.json`. |
| `--estado=ARQ` | Guarda o aprendizado nesse arquivo e o retoma ao reiniciar. Sem isso, o aprendizado se perde ao parar. |
| `--salvar-cada=S` | Segundos entre as gravações do estado. Padrão 30. |
| `--porta=N` | Porta. Padrão 8787. |
| `--host=H` | Endereço. Padrão `127.0.0.1`, que só aceita conexões desta máquina. |
| `--token=T` | Exige `Authorization: Bearer T` em tudo, menos em `/saude`. |

### Rotas

| Rota | O que faz |
|---|---|
| `GET /saude` | `{"ok": true}`. Não pede token. |
| `GET /estado` | Contadores de eventos, relógio e criativos ativos. |
| `GET /aprendido` | Taxa estimada por perfil e criativo, e o melhor criativo de cada perfil. |
| `POST /evento` | Um evento, uma lista de eventos ou JSON Lines. Devolve quantos foram aceitos, duplicados e rejeitados, e o motivo de cada recusa. |
| `POST /decidir` | `{"totem": "T-25", "leitura": {"H35-49": 3, "M25-34": 2}, "quando": "2026-01-05T08:00:00-03:00"}`. Devolve o criativo, a taxa esperada e a segunda opção. |
| `POST /campanha` | `{"criativo": "brasa-cafe", "ativa": false}` pausa ou retoma um criativo. Pelo menos um precisa ficar ativo. |

```bash
curl -X POST --data-binary @docs/exemplos/eventos-exemplo.jsonl http://127.0.0.1:8787/evento
curl -X POST -d '{"totem":"T-25","leitura":{"H35-49":3,"M25-34":2}}' http://127.0.0.1:8787/decidir
```

Códigos de resposta: 200 certo (mesmo com alguns eventos recusados, que vêm listados), 400 pedido malformado, 401 sem token, 404 totem ou rota desconhecidos e 413 para corpo acima de 1 MB (este último sem teste).

## Usar como biblioteca

```js
const Operador = require('./site/js/operador.js');

const op = Operador.criar({ cadastro });                       // ou { cadastro, estado } para retomar
op.decidir({ totem: 'T-25', leitura, quando });                // { criativo, esperado, segunda, periodo, mixEsperado }
op.registrar(evento);                                          // { aceito, motivo?, avisos? }
op.campanha('brasa-cafe', false);                              // pausa
op.aprendido();                                                // taxas e melhor criativo por perfil
op.exportar();                                                 // JSON para guardar
```

`examples/operador-demo.js` mostra o ciclo completo só pela API, com um mundo mínimo: `node examples/operador-demo.js` (e `--por-spot` para eventos só com o total de interações).

## O que o Operador faz com cada evento

- **Valida** o evento ([EVENTOS.md](EVENTOS.md#regras-de-qualidade)) e confere totem e criativo no cadastro. Recusa o que estiver errado, dizendo o motivo.
- **Descarta duplicatas** pelo campo `spot`. Lembra os últimos 100 mil spots.
- **Aceita eventos fora de ordem.** O aprendizado é o mesmo. Só o desgaste fica um pouco errado: um evento atrasado soma exposição como se fosse recente.
- **Mantém o relógio** no fim do evento mais recente. O tempo que passa esvazia a exposição de cada criativo (meia-vida de 150 minutos) e, a cada hora, o algoritmo esquece um pouco (1,5%).
- **Repartir interações sem perfil.** Quando o evento traz só o total, o Operador reparte entre os perfis presentes, proporcional à audiência vezes a taxa de cada perfil. Essa taxa é ajustada a cada evento por mínimos quadrados online (o total observado contra a soma de audiência × taxa), o que separa os perfis quando a mistura de pessoas varia de um spot para outro.
- **Sem ninguém à frente**, `decidir` usa o perfil médio recente daquele totem (ou todos os perfis iguais, se ainda não houver histórico). A resposta marca `mixEsperado: true`.

## Quanto o formato "só total" custa

Com eventos do simulador (uma semente), perfis cujo melhor criativo foi descoberto, de 8:

| Tempo de eventos | Interações por perfil | Só o total por spot |
|---|---|---|
| 4 horas | 6 | 2 |
| 12 horas | 7 | 7 |
| 1 dia | 8 | 8 |

Sem o ajuste por mínimos quadrados, repartindo só pela taxa que o algoritmo já estimava, o total por spot chegava a 3, 4 e 5 perfis. Em malha fechada, num mundo mínimo de 6 totens, o ganho sobre o rodízio foi de 29% com interações por perfil e 28% só com o total. Num totem só com QR, as primeiras horas aprendem bem mais devagar. A medição usa uma semente e o simulador, não dados reais.

## Guardar e retomar

`op.exportar()` devolve tudo o que o algoritmo aprendeu e o relógio, em JSON. O servidor grava isso no arquivo de `--estado`, a cada 30 segundos se algo mudou e ao receber Ctrl+C ou o sinal de encerramento. Testei a gravação periódica: eventos enviados, servidor derrubado à força, servidor reiniciado com o mesmo arquivo, e os mesmos eventos reenviados voltam como duplicados. A gravação ao encerrar com Ctrl+C não foi testada.

O estado só vale para o mesmo cadastro. Mudar o número de totens, de zonas ou de criativos exige começar de novo: o Operador recusa um estado que não combina.

## Limites

- **Nenhum totem real foi usado.** A câmera simulada erra 14% dos perfis. Uma câmera real pode errar de outro jeito.
- **Sem segurança de produção.** Sem criptografia (use por trás de um proxy com HTTPS), sem usuário por totem, sem limite de pedidos. Por padrão só aceita conexões da própria máquina. Não o exponha à internet sem proteção.
- **Um processo só.** Não há réplicas nem banco de dados. Se o servidor cair de repente (sem Ctrl+C), perde-se o que veio depois da última gravação, até 30 segundos por padrão.
- **Só medi o cálculo, não a rede.** No Node, numa máquina comum, `decidir` leva cerca de 3 microssegundos e `registrar` cerca de 40. Não medi a rota HTTP com muitos totens.
- **Cadastro fixo.** Entrar um criativo ou totem novo no meio da operação ainda não é possível sem perder o aprendizado (issue 7).
- **Sem metas por anunciante, sem conversões com atraso** (issues 8 e 6).
- **O relógio confia nos totens.** Um totem com a hora errada distorce o período do dia (quando o contexto de horário está ligado) e a ordem do desgaste.
