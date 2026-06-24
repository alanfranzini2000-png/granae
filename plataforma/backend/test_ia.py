"""
Teste simples: 10 linhas do banco para validar categorizar() com e sem IA.
Escolhe lancamentos que NAO casam com nenhuma regra fixa (candidatos a IA).

Uso:
  python test_ia.py
"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
# Encoding correto no Windows
sys.stdout.reconfigure(encoding="utf-8")

from database import get_conn
from categorizer import categorizar, categorizar_por_regra, ANTHROPIC_API_KEY

CONF_SIGLA = {"verde": "VRD", "amarelo": "AML", "vermelho": "VRM"}

def fmt_pred(cat, conf, fonte):
    sigla = CONF_SIGLA.get(conf, conf[:3].upper())
    return f"{cat or '?'}[{sigla},{fonte or '-'}]"

def main():
    print(f"\n{'='*65}")
    print(f"ANTHROPIC_API_KEY configurada: {bool(ANTHROPIC_API_KEY)}")
    if not ANTHROPIC_API_KEY:
        print("  -> Crie backend/.env com: ANTHROPIC_API_KEY=sk-ant-...")
    print(f"{'='*65}\n")

    conn = get_conn()
    rows = conn.execute(
        "SELECT descricao, valor, tipo, categoria, fonte FROM lancamentos "
        "WHERE categoria IS NOT NULL AND categoria != '' "
        "ORDER BY RANDOM() LIMIT 400"
    ).fetchall()
    conn.close()

    # Seleciona apenas lancamentos sem regra fixa e sem PIX
    candidatos = []
    for r in rows:
        _, status = categorizar_por_regra(r["descricao"])
        is_pix = "PIX" in r["descricao"].upper()
        if status == "sem_regra" and not is_pix:
            candidatos.append(r)
        if len(candidatos) >= 10:
            break

    if not candidatos:
        print("Nenhum lancamento sem regra encontrado na amostra. Tente novamente.")
        return

    print(f"{'Descricao':<38} {'Real':<5} {'Sem IA':<18} {'Com IA':<22} Mudou?")
    print("-" * 90)

    mudancas = 0
    acertos_sem = 0
    acertos_com = 0

    for r in candidatos:
        desc     = r["descricao"]
        valor    = r["valor"]
        tipo     = r["tipo"]
        cat_real = r["categoria"]

        c_sem, conf_sem, f_sem = categorizar(desc, valor, tipo, usar_ia=False, is_pix=False)
        c_com, conf_com, f_com = categorizar(desc, valor, tipo, usar_ia=True,  is_pix=False)

        mudou = (c_sem != c_com) or (conf_sem != conf_com)
        if mudou:
            mudancas += 1
        if c_sem == cat_real:
            acertos_sem += 1
        if c_com == cat_real:
            acertos_com += 1

        tag_mud = "<-- MUDOU" if mudou else ""
        print(
            f"{desc[:37]:<38} {cat_real:<5} "
            f"{fmt_pred(c_sem, conf_sem, f_sem):<18} "
            f"{fmt_pred(c_com, conf_com, f_com):<22} "
            f"{tag_mud}"
        )

    n = len(candidatos)
    print(f"\n{'='*65}")
    print(f"Total testado : {n}")
    print(f"Sem IA acertos: {acertos_sem}/{n} ({acertos_sem/n*100:.0f}%)")
    print(f"Com IA acertos: {acertos_com}/{n} ({acertos_com/n*100:.0f}%)")
    print(f"Predicoes mudadas com IA: {mudancas}/{n}")

    if not ANTHROPIC_API_KEY:
        print("\n[!] Sem chave: os resultados COM IA sao identicos aos SEM IA.")
        print("    Isso confirma que a logica de fallback esta correta.")
    elif mudancas == 0:
        print("\n[!] Nenhuma predicao mudou — verifique se a chave esta valida.")
    else:
        print(f"\n[OK] IA alterou {mudancas} de {n} predicoes.")
    print(f"{'='*65}\n")

if __name__ == "__main__":
    main()
