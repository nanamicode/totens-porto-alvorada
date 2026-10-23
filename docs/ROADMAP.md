# Roadmap

## Organização do código
- [x] Separar `site/index.html` em módulos: mundo simulado, algoritmo, interface e menu de cálculos.
- [x] Mover o algoritmo (`Brain`) para um módulo sem dependência de interface, pronto para rodar fora do navegador.
- [x] Testes automáticos do algoritmo: convergência, acerto do melhor criativo por perfil e comparação com a rotação, com várias sementes.

## Algoritmo
- [ ] Período do dia como contexto.
- [ ] Estimar o desgaste por criativo e por totem, em vez de um valor genérico.
- [ ] Recompensa com atraso (conversão depois da interação).
- [ ] Criativos novos entrando no meio da operação (partida a frio).
- [ ] Metas de entrega por anunciante (impressões contratadas e orçamento).

## Simulador
- [ ] Comparar duas configurações lado a lado.
- [ ] Salvar e carregar cenários.
- [ ] Rodar várias sementes e mostrar a variação do ganho.

## Dados reais
- [ ] Definir o formato de evento do totem: contagem por perfil, criativo exibido e interações.
- [ ] Conectar `Brain` a eventos reais.
- [ ] Revisão de privacidade e LGPD antes de qualquer instalação.
