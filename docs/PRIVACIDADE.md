# Privacidade e LGPD

> **Isto não é parecer jurídico.** A issue 14 pede revisão com apoio jurídico antes de qualquer instalação, e isso continua pendente. Este documento prepara essa revisão: mostra, com base no código, o que o software processa, guarda e transmite, o que ele impede por construção, o que ele não pode garantir e quais perguntas só um advogado ou o encarregado de dados (DPO) responde. Os artigos da Lei 13.709/2018 (LGPD) citados são pontos de partida para a conversa, e não conclusões.

## Resumo

- O software deste repositório **nunca recebe imagem, vídeo, rosto, identificador de pessoa nem de aparelho**. Ele só recebe contagens de pessoas por perfil (8 perfis de gênero estimado e faixa etária), contagens de interações e o identificador do totem e do criativo.
- **A câmera e o classificador não estão neste repositório.** Quem gera as contagens é o totem. Que a imagem seja descartada no próprio totem, e que o classificador não guarde nada, é uma exigência sobre o totem que este código não consegue verificar. Isso precisa ser verificado no equipamento e no contrato com o fornecedor.
- O ponto juridicamente mais sensível não está no servidor, e sim **no totem**: estimar gênero e faixa etária a partir da imagem de uma pessoa é um tratamento, mesmo que a imagem seja descartada em seguida e só a contagem saia dali.
- Nenhum totem real foi usado. O servidor é um protótipo, sem criptografia.

## O que o software processa, guarda e transmite

| Componente | O que recebe ou guarda | Pessoal? | Como está travado |
|---|---|---|---|
| Evento `spot` (`POST /evento`) | Totem, criativo, início e duração do spot, contagens por perfil (audiência e interações) | Contagens agregadas por spot | O validador recusa qualquer campo fora do formato, em qualquer nível, e qualquer contagem que não seja inteiro (`Eventos.validar`; schema com `additionalProperties: false`) |
| Leitura em tempo real (`POST /decidir`) | Totem, contagens por perfil à frente da tela, hora | Contagens agregadas | Desde esta mudança, campos extras, perfis desconhecidos e valores que não sejam inteiros são recusados (`Operador.validarPedido`) |
| Pausar ou retomar campanha (`POST /campanha`) | Criativo e verdadeiro ou falso | Não | Só esses dois campos são aceitos |
| Estado do aprendizado (`--estado`, `Operador.exportar`) | Cadastro de totens e criativos, contagens aprendidas por perfil, perfil médio recente de cada totem, relógio, últimos 20.000 identificadores de spot | Não contém dado de pessoa | Um teste confere que o estado só tem identificadores do cadastro, identificadores de spot e números |
| Servidor HTTP (`tools/servidor.js`) | Não escreve registro de acesso nem guarda endereço de quem chama | Não | Um teste confere que nenhuma saída é escrita ao receber pedidos |
| Site simulado (`site/`) | Nada: roda inteiro no navegador, com dados simulados | Não | Um teste confere que o código não usa câmera, rede de dados, armazenamento do navegador nem localização |

Sobre as contagens: um spot com uma só pessoa à frente vira `{"H25-34": 1}` num totem, numa hora. Isso não identifica ninguém sozinho, mas é uma observação sobre uma pessoa naquele lugar e momento. Se o jurídico entender que isso pede agregação maior (por exemplo, só eventos com pelo menos N pessoas, ou janelas mais longas), é uma mudança pequena no totem ou no operador. Hoje o formato envia todo spot, até os vazios, porque o algoritmo precisa saber quanto cada criativo foi exibido.

## O que as garantias técnicas não cobrem

1. **O totem.** A câmera, o classificador, onde a imagem existe e por quanto tempo, o que fica em memória ou em disco do equipamento, e se o fornecedor envia telemetria própria. Nada disso é visível aqui.
2. **O que passa pela rede antes do servidor.** Proxy, balanceador, provedor de nuvem e logs de infraestrutura costumam registrar endereço IP, horário e rota. O servidor deste repositório não registra, mas a infraestrutura em volta pode.
3. **Criptografia e controle de acesso.** O servidor é HTTP puro. A proteção é um token opcional, e `GET /estado` e `GET /aprendido` ficam abertos se ele não for usado. Antes de qualquer instalação precisa de TLS (por exemplo, atrás de um proxy), token obrigatório e rede restrita. A LGPD pede medidas de segurança proporcionais (art. 46).
4. **Retenção.** O servidor não guarda eventos, só o aprendizado e os últimos identificadores de spot. Quem guarda eventos brutos (um arquivo `.jsonl` exportado, por exemplo) decide por quanto tempo, e hoje não há política.
5. **Site público.** O site carrega a fonte do Google Fonts e o Three.js do cdnjs. Quem abre a página envia seu endereço IP a esses servidores. O CSS das fontes provavelmente puxa os arquivos de outro servidor do Google, o que não verifiquei. Isso não tem relação com o público dos totens, mas vale para quem visita o site: antes de publicá-lo, considere hospedar esses arquivos junto com a página. Um teste trava a lista de servidores externos para que ninguém acrescente outro sem perceber.
6. **Dados de teste.** O repositório só tem dados simulados.

## Perguntas para o jurídico e o encarregado de dados

1. **Estimar gênero e faixa etária a partir da imagem é tratamento de dado pessoal?** Se a imagem é processada no totem e descartada, o que sai é só a contagem. A LGPD define dado pessoal como informação relacionada a pessoa natural identificada ou identificável (art. 5º, I), e trata o dado anonimizado como fora da lei, salvo se a anonimização puder ser revertida com esforços razoáveis (art. 12). O tratamento na câmera conta como tratamento para esse efeito?
2. **É dado biométrico ou sensível?** Dado biométrico vinculado a uma pessoa é dado pessoal sensível (art. 5º, II), com regras mais fechadas (art. 11). A estimativa de faixa etária e gênero, sem identificar ninguém, entra nessa categoria? Isso muda a base legal possível.
3. **Qual base legal?** O legítimo interesse (art. 7º, IX) exige uma avaliação do interesse legítimo e do equilíbrio com os direitos de quem passa. Há outra base mais adequada? Se tudo for anonimizado de verdade, o assunto muda (pergunta 1).
4. **Quem é o controlador e quem é o operador?** O anunciante, a empresa dona dos totens, o fornecedor da câmera e quem opera este algoritmo têm papéis diferentes. Quem responde pelo quê, e o que precisa estar em contrato?
5. **Aviso ao público.** Qual é o aviso exigido, onde ele precisa estar (no totem, na entrada da área, num endereço na internet) e com que conteúdo (art. 9º)? Há um rascunho abaixo.
6. **Relatório de impacto.** É preciso um relatório de impacto à proteção de dados (art. 38) e um registro das operações (art. 37) antes de instalar?
7. **Crianças e adolescentes.** A câmera vê qualquer pessoa que passa, inclusive menores. O perfil começa em 18 anos, mas a câmera ainda os vê e os classifica de alguma forma. O que a lei pede nesse caso?
8. **Locais específicos.** Há regras próprias para os lugares onde os totens ficariam (shopping, estação, campus, via pública)? Os donos desses lugares impõem condições?
9. **Direitos do titular.** Se os dados são anonimizados na origem, não há como atender pedidos de acesso ou eliminação de uma pessoa. Isso é aceitável, e como isso é explicado no aviso?
10. **Canal de contato.** Quem é o encarregado de dados e qual canal o aviso informa?

## Rascunho do aviso ao público

Texto de partida, para o jurídico reescrever. Os trechos entre colchetes precisam ser preenchidos.

> **Esta tela conta pessoas que olham para ela.**
> Uma câmera nesta tela estima quantas pessoas estão olhando e, de forma aproximada, a faixa etária e o gênero delas, para escolher o anúncio mais adequado. **As imagens não são gravadas nem enviadas: são descartadas no próprio equipamento.** Só saem números agregados, como "2 pessoas de 25 a 34 anos", sem identificar ninguém.
> Responsável: [razão social e CNPJ]. Dúvidas e pedidos: [nome do encarregado e canal]. Mais informações: [endereço da política].

## Lista de verificação antes de instalar

Do lado técnico:
- [ ] Confirmar com o fornecedor, por escrito e com teste no equipamento, que a imagem nunca sai do totem nem é gravada em disco, e que não há telemetria de imagem.
- [ ] Confirmar que o que o totem envia ao servidor é exatamente o evento `spot` e o pedido de `decidir` (capturar o tráfego real e conferir).
- [ ] Colocar o servidor atrás de TLS e restringir quem o alcança. O token obrigatório fora do endereço local já é exigido pelo comando (pelo menos 16 caracteres), mas a conexão continua sem criptografia. Conferir os logs da infraestrutura (IP, rota) e definir por quanto tempo ficam.
- [ ] Definir a retenção do arquivo de estado e de qualquer exportação de eventos.
- [ ] Decidir se o formato precisa de agregação mínima (por exemplo, não enviar spots com uma só pessoa).
- [ ] Hospedar a fonte e o Three.js do site junto com a página, se o site for público.

Do lado jurídico (as perguntas acima):
- [ ] Base legal definida e registrada.
- [ ] Avaliação do interesse legítimo e relatório de impacto, se exigidos.
- [ ] Contratos com o fornecedor da câmera, o dono dos totens e os locais.
- [ ] Aviso aprovado, instalado e com canal de contato funcionando.
- [ ] Encarregado de dados nomeado.

## Como as garantias são conferidas

`tests/privacidade.test.js` roda com `npm test` e trava o que o código promete: o evento recusa campos extras e contagens que não sejam inteiros, o pedido de `decidir` e o de `campanha` também, o servidor não devolve o que recusou nem escreve registros, o estado guardado só tem identificadores e números, e o site não usa câmera, rede de dados nem armazenamento do navegador, e só fala com os dois servidores externos conhecidos. Esses testes impedem que o próprio código passe a aceitar ou guardar mais do que deve. Eles não provam nada sobre o totem nem sobre a infraestrutura.
