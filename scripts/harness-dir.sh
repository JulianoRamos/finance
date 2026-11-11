# A definição única da pasta de estado do harness: a `.harness/` na raiz do checkout, ignorada pelo
# Git. Quem carrega este arquivo com `source` (o scripts/verify.sh e os hooks de .claude/hooks/) recebe
# o HARNESS_DIR. A raiz do checkout é a do CLAUDE_PROJECT_DIR, quando definido, e senão a deste script:
# nunca a da pasta atual de quem chama, porque os hooks rodam na pasta da sessão, que pode mudar. Se a
# raiz não é uma pasta que se alcança, o HARNESS_DIR fica vazio, e quem chama decide o que fazer.

HARNESS_DIR="$(cd "${CLAUDE_PROJECT_DIR:-$(dirname "${BASH_SOURCE[0]}")/..}" 2>/dev/null && pwd -P)"
HARNESS_DIR="${HARNESS_DIR:+$HARNESS_DIR/.harness}"
