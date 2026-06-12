"""
Script de limpeza da base de lançamentos.
Remove entradas com descrição suja (contendo docto + valor + saldo no final).

Execute em duas etapas:
  1. python limpar_base.py          → mostra o que seria removido (dry run)
  2. python limpar_base.py --apply  → executa a remoção
"""
import re
import sys
from database import get_conn

# Padrão de descrição suja:
# Termina com sequência numérica que parece docto + valor + saldo
# Ex: "Joao Antonio de Vasconcel 000000 -102,00 5.774,28"
# Ex: "TED ENVIADA CANAIS 102-0001-000016359128 000000 -1.000,00 6.003,96"
# Ex: "MINUTO PA 8190 214255 -7,29 5.593,81"
PADRAO_SUJO = re.compile(
    r'.+\s+'                              # descrição legítima
    r'[\d\-\.]+\s+'                       # docto ou número extra
    r'-?\d{1,3}(?:\.\d{3})*,\d{2}\s+'   # valor
    r'\d{1,3}(?:\.\d{3})*,\d{2}\s*$'    # saldo
)

def main():
    apply = '--apply' in sys.argv
    conn = get_conn()

    rows = conn.execute(
        "SELECT id, data, descricao, valor, categoria, origem FROM lancamentos"
    ).fetchall()

    sujos = []
    for row in rows:
        if PADRAO_SUJO.match(row['descricao']):
            sujos.append(dict(row))

    print(f"Total na base: {len(rows)}")
    print(f"Lançamentos com descrição suja: {len(sujos)}\n")

    if not sujos:
        print("✓ Base limpa, nada a remover.")
        conn.close()
        return

    print("Serão removidos:")
    print(f"{'ID':>6} | {'Data':12} | {'Valor':>10} | {'Cat':4} | {'Origem':10} | Descrição")
    print("-" * 100)
    for s in sujos:
        print(f"{s['id']:>6} | {s['data']:12} | R${s['valor']:>9.2f} | {s['categoria'] or '?':4} | {s['origem']:10} | {s['descricao'][:60]}")

    if not apply:
        print(f"\n⚠️  Dry run — nenhuma alteração feita.")
        print(f"Para aplicar: python limpar_base.py --apply")
    else:
        ids = [s['id'] for s in sujos]
        conn.execute(
            f"DELETE FROM lancamentos WHERE id IN ({','.join('?' * len(ids))})",
            ids
        )
        conn.commit()
        print(f"\n✓ {len(sujos)} lançamentos removidos.")

    conn.close()

if __name__ == '__main__':
    main()
