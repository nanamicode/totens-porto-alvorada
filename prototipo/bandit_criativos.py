"""Prototipo: Thompson Sampling contextual por segmento (sexo x idade) com fadiga por frequencia.

Dados 100% simulados. Compara Thompson Sampling com A/B uniforme.
Uso: python bandit_criativos.py
"""
import numpy as np

rng = np.random.default_rng(42)

SEXOS = ["M", "F"]
IDADES = ["18-24", "25-34", "35-44", "45+"]
SEGMENTOS = [(s, i) for s in SEXOS for i in IDADES]
CRIATIVOS = ["A_humor", "B_depoimento", "C_oferta", "D_produto"]
DIAS = 30
IMPRESSOES_DIA = 20000
DECAY = 0.0025  # perda de CTR por exposicao acumulada do criativo no segmento (fadiga)
OLVIDO = 0.97  # desconto diario nos dados antigos (melhor criativo muda com o tempo)

# CTR verdadeiro (oculto do algoritmo): criativo x segmento
CTR_BASE = {seg: rng.uniform(0.008, 0.02, len(CRIATIVOS)) for seg in SEGMENTOS}
# cada segmento tem um criativo claramente melhor
for seg in SEGMENTOS:
    CTR_BASE[seg][rng.integers(len(CRIATIVOS))] += 0.02


def ctr_real(seg, c, expos_acum):
    """CTR cai com a exposicao acumulada (wear-out simples)."""
    return CTR_BASE[seg][c] * np.exp(-DECAY * expos_acum / 100)


class ThompsonContextual:
    """Beta-Bernoulli por (segmento, criativo), com esquecimento diario."""

    def __init__(self):
        self.a = {s: np.ones(len(CRIATIVOS)) for s in SEGMENTOS}
        self.b = {s: np.ones(len(CRIATIVOS)) for s in SEGMENTOS}

    def alocar(self, seg, n):
        """Divide n impressoes entre criativos pela probabilidade de cada ser o melhor."""
        amostras = rng.beta(self.a[seg][:, None], self.b[seg][:, None], (len(CRIATIVOS), 200))
        p_melhor = np.bincount(amostras.argmax(0), minlength=len(CRIATIVOS)) / 200
        return rng.multinomial(n, p_melhor)

    def atualizar(self, seg, c, imp, cliques):
        self.a[seg][c] += cliques
        self.b[seg][c] += imp - cliques

    def esquecer(self):
        for s in SEGMENTOS:
            self.a[s] = 1 + (self.a[s] - 1) * OLVIDO
            self.b[s] = 1 + (self.b[s] - 1) * OLVIDO


def simular(politica):
    expos = {s: np.zeros(len(CRIATIVOS)) for s in SEGMENTOS}
    bandit = ThompsonContextual()
    total_cliques = 0
    imp_por_seg = IMPRESSOES_DIA // len(SEGMENTOS)
    historico = []
    for dia in range(DIAS):
        cliques_dia = 0
        for seg in SEGMENTOS:
            if politica == "thompson":
                aloc = bandit.alocar(seg, imp_por_seg)
            else:  # A/B uniforme
                aloc = np.full(len(CRIATIVOS), imp_por_seg // len(CRIATIVOS))
            for c, n in enumerate(aloc):
                if n == 0:
                    continue
                cliques = rng.binomial(n, ctr_real(seg, c, expos[seg][c]))
                expos[seg][c] += n
                cliques_dia += cliques
                if politica == "thompson":
                    bandit.atualizar(seg, c, n, cliques)
        if politica == "thompson":
            bandit.esquecer()
        total_cliques += cliques_dia
        historico.append(cliques_dia)
    return total_cliques, historico, bandit


def main():
    ab, _, _ = simular("ab")
    ts, hist, bandit = simular("thompson")
    total_imp = DIAS * IMPRESSOES_DIA
    print(f"Impressoes totais: {total_imp:,}")
    print(f"A/B uniforme   : {ab:,} cliques (CTR {ab/total_imp:.2%})")
    print(f"Thompson ctx   : {ts:,} cliques (CTR {ts/total_imp:.2%})  ganho {ts/ab-1:+.1%}")
    print("\nCriativo preferido aprendido vs. melhor real por segmento:")
    acertos = 0
    for seg in SEGMENTOS:
        media = bandit.a[seg] / (bandit.a[seg] + bandit.b[seg])
        pred, real = CRIATIVOS[media.argmax()], CRIATIVOS[CTR_BASE[seg].argmax()]
        acertos += pred == real
        print(f"  {seg[0]} {seg[1]:>5}: aprendido={pred:<13} real={real:<13} {'OK' if pred == real else '--'}")
    print(f"Acertos: {acertos}/{len(SEGMENTOS)}")


if __name__ == "__main__":
    main()
