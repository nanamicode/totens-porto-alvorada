# Roadmap

## Organização do código
- [x] Separar `site/index.html` em módulos: mundo simulado, algoritmo, interface e menu de cálculos.
- [x] Mover o algoritmo (`Brain`) para um módulo sem dependência de interface, pronto para rodar fora do navegador.
- [x] Testes automáticos do algoritmo: convergência, acerto do melhor criativo por perfil e comparação com a rotação, com várias sementes.

## Algoritmo
- [x] Período do dia como contexto. Opcional e desligado por padrão: só ajuda quando o efeito do horário é forte.
- [x] Estimar o desgaste por totem, em vez de um valor genérico. Falta o desgaste por criativo, que o mundo simulado ainda não tem.
- [x] Recompensa com atraso (conversão depois da interação). O mundo simula a conversão e o algoritmo aprende com ela; o operador real ainda não recebe conversões atrasadas.
- [x] Criativos novos entrando no meio da operação (partida a frio). Botão "Lançar criativo novo" e métrica de tempo até testar e adotar.
- [x] Metas de entrega por anunciante (impressões contratadas e orçamento). Painel de cumprimento e opção de equilibrar o algoritmo com as metas, desligada por padrão.

## Simulador
- [x] Redesenho visual completo, com opção 3D. Direção "Noite urbana", tema claro "Dia", vista 3D com Three.js.
- [x] Comparar duas configurações lado a lado.
- [x] Salvar e carregar cenários. Ver docs/CENARIOS.md.
- [x] Rodar várias sementes e mostrar a variação do ganho.

## Dados reais
- [x] Definir o formato de evento do totem: contagem por perfil, criativo exibido e interações. Ver docs/EVENTOS.md.
- [x] Conectar `Brain` a eventos reais. Operador e servidor em docs/OPERACAO.md. Falta testar com um totem de verdade.
- [ ] Revisão de privacidade e LGPD antes de qualquer instalação.
