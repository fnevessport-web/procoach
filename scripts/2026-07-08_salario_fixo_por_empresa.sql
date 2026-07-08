-- Separa o "Salário Fixo" do colaborador (professores.salario_fixo) em um valor
-- por empresa, e marca de qual empresa é cada lançamento de pagamentos_extras.
-- Motivo: colaboradores como o Fernando e o Michel recebem fixo tanto da
-- Procópio quanto da Beach Arena, e hoje só existe UM campo de salário fixo
-- (sem saber a qual empresa pertence) e os extras não tem essa marcação —
-- então não dá pra saber, sem isso, quanto cada empresa deve pagar.

-- 1. Dois campos de salário fixo, um por empresa (substituem o antigo
--    "salario_fixo", que nunca foi de fato usado em nenhum cálculo).
alter table professores add column if not exists salario_fixo_procopio numeric;
alter table professores add column if not exists salario_fixo_beach numeric;

-- 2. Marca de qual empresa é cada pagamento extra (bônus, diária, salário
--    fixo gerado automaticamente, etc). Fica nulo para os registros antigos
--    (lançados antes dessa mudança) — o sistema já sabe tratar esse caso.
alter table pagamentos_extras add column if not exists empresa text;
