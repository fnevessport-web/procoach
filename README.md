# 🏆 ProCoach

PWA para gestão de aulas esportivas, controle de presença e pagamento de professores.

## Stack

- React 19 + Vite 8
- Tailwind CSS v4
- Supabase (banco + auth)
- vite-plugin-pwa (Service Worker + manifest)
- Zustand, TanStack Query, Recharts

## Configuração do Banco de Dados

### Passo 1 — Executar o SQL no Supabase

1. Acesse: https://supabase.com/dashboard/project/xmntwdppiflfwoaccknd
2. Vá em **SQL Editor** > **New query**
3. Cole e execute o conteúdo de `supabase/migrations/001_initial_schema.sql`

Esse script cria todas as tabelas, habilita RLS, cria políticas e insere as 7 modalidades.

### Passo 2 — Chave Supabase

Se o client JS exigir chave JWT (começa com eyJ):
1. Dashboard > **Project Settings** > **API**
2. Copie a `anon public` key
3. Atualize `src/lib/supabase.js`

### Passo 3 — Criar admin

Após cadastrar o primeiro usuário:
```sql
UPDATE perfis_usuario SET role = 'admin', nome = 'Admin' WHERE user_id = (
  SELECT id FROM auth.users ORDER BY created_at LIMIT 1
);
```

## Rodar localmente

```bash
npm install
npm run dev
# Acesse http://localhost:5173
```

## Build + Deploy

```bash
npm run build
# Deploy na Vercel/Netlify: basta conectar o repositório
```

## Perfis

| admin | acesso total |
| coordenador | confirma aulas, KPIs |
| professor | confirma suas aulas, presença |

## Licença

MIT — ProCoach 2025
