-- Aba CAMPEONATOS (pedido de 07/11/2026, para o Mixed Doubles Challenge de 08/11/2026).
--
-- Quatro tabelas:
--   campeonatos            -> o torneio (nome, data, quadras, horário, status do sorteio)
--   campeonato_atletas     -> inscritos (nome, gênero, situação, check-in, foto)
--   campeonato_duplas      -> duplas sorteadas (atleta1 = homem, atleta2 = mulher)
--   campeonato_jogos       -> chave (rodada/posição), quadra, horário "não antes de", placar ao vivo
--
-- Leitura pública (o link do associado e a TV não têm login), escrita só da gestão.
-- O associado só consegue gravar a própria foto, pela função campeonato_salvar_foto.
-- As tabelas entram na publicação de tempo real do Supabase (placar ao vivo e sorteio ao vivo).
--
-- Como aplicar: rodar este arquivo inteiro no Supabase -> SQL Editor. É idempotente.

create table if not exists campeonatos (
  id                 uuid primary key default gen_random_uuid(),
  slug               text not null unique,
  nome               text not null,
  subtitulo          text,
  data               date,
  local              text,
  status             text not null default 'inscricoes'
                       check (status in ('inscricoes', 'sorteio', 'em_andamento', 'encerrado')),
  quadras            text[] not null default '{Quadra 3,Quadra 4}',
  hora_inicio        text not null default '09:30',
  duracao_min        int not null default 40,
  disputa_terceiro   boolean not null default true,
  regras             text,
  sorteio_revelados  int not null default 0,
  sorteio_em         timestamptz,
  criado_em          timestamptz not null default now()
);

create table if not exists campeonato_atletas (
  id             uuid primary key default gen_random_uuid(),
  campeonato_id  uuid not null references campeonatos(id) on delete cascade,
  nome           text not null,
  genero         text not null check (genero in ('M', 'F')),
  situacao       text not null default 'inscrito' check (situacao in ('inscrito', 'espera', 'desistiu')),
  presente       boolean not null default false,
  foto           text,
  ordem          int not null default 0,
  criado_em      timestamptz not null default now()
);
create index if not exists campeonato_atletas_camp_idx on campeonato_atletas (campeonato_id);

-- Token do aparelho que mandou a foto (fora da tabela pública, para ninguém ler e sobrescrever).
create table if not exists campeonato_foto_tokens (
  atleta_id  uuid primary key references campeonato_atletas(id) on delete cascade,
  token      text not null
);

create table if not exists campeonato_duplas (
  id             uuid primary key default gen_random_uuid(),
  campeonato_id  uuid not null references campeonatos(id) on delete cascade,
  numero         int not null,
  atleta1_id     uuid references campeonato_atletas(id) on delete set null,
  atleta2_id     uuid references campeonato_atletas(id) on delete set null,
  criado_em      timestamptz not null default now()
);
create index if not exists campeonato_duplas_camp_idx on campeonato_duplas (campeonato_id);

create table if not exists campeonato_jogos (
  id             uuid primary key default gen_random_uuid(),
  campeonato_id  uuid not null references campeonatos(id) on delete cascade,
  rodada         int not null,
  posicao        int not null,
  fase           text not null,
  dupla_a_id     uuid references campeonato_duplas(id) on delete set null,
  dupla_b_id     uuid references campeonato_duplas(id) on delete set null,
  quadra         text,
  horario        text,
  ordem          int not null default 0,
  status         text not null default 'agendado'
                   check (status in ('agendado', 'ao_vivo', 'finalizado', 'wo', 'bye')),
  sets           jsonb not null default '[]',
  vencedor_id    uuid references campeonato_duplas(id) on delete set null,
  iniciado_em    timestamptz,
  finalizado_em  timestamptz,
  criado_em      timestamptz not null default now()
);
create index if not exists campeonato_jogos_camp_idx on campeonato_jogos (campeonato_id);

-- Mesmo helper do script de recados (recriado aqui para este script rodar sozinho).
create or replace function sou_gestao() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from perfis_usuario where user_id = auth.uid() and role in ('admin', 'gestor', 'coordenador'))
$$;
grant execute on function sou_gestao() to authenticated;

alter table campeonatos            enable row level security;
alter table campeonato_atletas     enable row level security;
alter table campeonato_duplas      enable row level security;
alter table campeonato_jogos       enable row level security;
alter table campeonato_foto_tokens enable row level security;

do $$
declare t text;
begin
  foreach t in array array['campeonatos', 'campeonato_atletas', 'campeonato_duplas', 'campeonato_jogos'] loop
    execute format('drop policy if exists %I on %I', t || '_ler', t);
    execute format('create policy %I on %I for select to anon, authenticated using (true)', t || '_ler', t);
    execute format('drop policy if exists %I on %I', t || '_gestao', t);
    execute format('create policy %I on %I for all to authenticated using (sou_gestao()) with check (sou_gestao())', t || '_gestao', t);
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table %I', t);
    end if;
  end loop;
end $$;

-- campeonato_foto_tokens: sem policy nenhuma (só a função abaixo mexe nela).

-- O associado manda a própria foto pelo link público. O primeiro aparelho que mandar fica
-- "dono" da foto daquele atleta (token salvo no navegador); outro aparelho não consegue trocar.
-- A gestão troca ou apaga pela tela interna.
create or replace function campeonato_salvar_foto(p_atleta_id uuid, p_foto text, p_token text)
returns void language plpgsql security definer set search_path = public as $$
declare v_token text;
begin
  if p_foto is null or left(p_foto, 11) <> 'data:image/' or length(p_foto) > 400000 then
    raise exception 'Foto inválida';
  end if;
  if p_token is null or length(p_token) < 16 then
    raise exception 'Token inválido';
  end if;
  if not exists (
    select 1 from campeonato_atletas a join campeonatos c on c.id = a.campeonato_id
    where a.id = p_atleta_id and c.status <> 'encerrado'
  ) then
    raise exception 'Atleta não encontrado';
  end if;
  select token into v_token from campeonato_foto_tokens where atleta_id = p_atleta_id;
  if v_token is not null and v_token <> p_token then
    raise exception 'A foto deste atleta já foi enviada por outro aparelho. Peça para a organização trocar.';
  end if;
  insert into campeonato_foto_tokens (atleta_id, token) values (p_atleta_id, p_token)
    on conflict (atleta_id) do update set token = excluded.token;
  update campeonato_atletas set foto = p_foto where id = p_atleta_id;
end $$;
grant execute on function campeonato_salvar_foto(uuid, text, text) to anon, authenticated;

-- Quando a gestão apaga a foto, libera o token (o atleta pode mandar de novo de qualquer aparelho).
create or replace function campeonato_limpar_token_foto() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.foto is null and old.foto is not null then
    delete from campeonato_foto_tokens where atleta_id = new.id;
  end if;
  return new;
end $$;
drop trigger if exists campeonato_atletas_foto_trg on campeonato_atletas;
create trigger campeonato_atletas_foto_trg after update of foto on campeonato_atletas
  for each row execute function campeonato_limpar_token_foto();

-- ---------------------------------------------------------------------------------------------
-- Torneio de 08/11/2026 já cadastrado com os inscritos da planilha
-- "Inscritos-as MIXED DOUBLE CHALLENGE.xlsx" (Drive "Seletiva Tenis").
-- 16 homens + 15 mulheres confirmados (canceladas e duplicadas fora). Lista de espera masculina
-- entra como "espera", na ordem da planilha. Só insere se o torneio ainda não existir.
-- ---------------------------------------------------------------------------------------------
do $$
declare v_id uuid;
begin
  if exists (select 1 from campeonatos where slug = 'mixed-doubles-2026') then
    return;
  end if;

  insert into campeonatos (slug, nome, subtitulo, data, local, quadras, hora_inicio, duracao_min, regras)
  values (
    'mixed-doubles-2026',
    'Mixed Doubles Challenge',
    'Primeiro Torneio de Duplas Mistas Beyond The Club',
    '2026-11-08',
    'Beyond The Club',
    '{Quadra 3,Quadra 4}',
    '09:30',
    40,
    E'Duplas mistas sorteadas às 9h entre os presentes.\nEliminatória simples, melhor de 3 sets curtos.\n1º e 2º sets até 4 games, com diferença de 2. No 4 a 4, tie-break até 7 (diferença de 2).\n3º set: direto no tie-break até 7 (diferença de 2).\nAquecimento de no máximo 5 minutos.\nTolerância de 15 minutos a partir da chamada oficial. Depois disso, W.O.\nEm caso de ausência, substituição por suplente associado do clube.\nCasos omissos: Organização do Torneio e Árbitro Geral Josué Lima.'
  )
  returning id into v_id;

  insert into campeonato_atletas (campeonato_id, nome, genero, situacao, ordem)
  select v_id, x.nome, x.genero, x.situacao, x.ordem
  from (values
    ('Luiza Pizzo Barbosa', 'F', 'inscrito', 1),
    ('Ana Paula Bertholo', 'F', 'inscrito', 2),
    ('Debora Cunha', 'F', 'inscrito', 3),
    ('Manuela Hartmann de Castro', 'F', 'inscrito', 4),
    ('Gisele Záccaro de Oliveira Manchon', 'F', 'inscrito', 5),
    ('Flavia Gotfryd', 'F', 'inscrito', 6),
    ('Tatiane Siqueira', 'F', 'inscrito', 7),
    ('Maria Neves', 'F', 'inscrito', 8),
    ('Erika Rubio Calmon de Aguiar Carneiro', 'F', 'inscrito', 9),
    ('Kelly Saavedra', 'F', 'inscrito', 10),
    ('Melissa Dringoli', 'F', 'inscrito', 11),
    ('Ana Luisa Medici', 'F', 'inscrito', 12),
    ('Dora Szwarc', 'F', 'inscrito', 13),
    ('Diana Krepinsky Rodrigues', 'F', 'inscrito', 14),
    ('Ilana Meiches Poljokan', 'F', 'inscrito', 15),
    ('Lohran Anguera Lima', 'M', 'inscrito', 1),
    ('Cesar Cotait Kara José', 'M', 'inscrito', 2),
    ('Felipe Andreu Silva', 'M', 'inscrito', 3),
    ('Leonardo Antonio Cardoso', 'M', 'inscrito', 4),
    ('David Hamaoui', 'M', 'inscrito', 5),
    ('Mauricio Povoa Barbosa', 'M', 'inscrito', 6),
    ('Joao Vitor de Souza Dias', 'M', 'inscrito', 7),
    ('Sérgio Cardoso Dias', 'M', 'inscrito', 8),
    ('Rui Minoru Katakura', 'M', 'inscrito', 9),
    ('Carlos Cortez', 'M', 'inscrito', 10),
    ('Dennis William Andrade', 'M', 'inscrito', 11),
    ('Marcelo Fogagnolo Cobra', 'M', 'inscrito', 12),
    ('Gabriel Souza Cury', 'M', 'inscrito', 13),
    ('Luiz Gustavo Mariano', 'M', 'inscrito', 14),
    ('André Kinjo Kubota', 'M', 'inscrito', 15),
    ('Rafael Andrade Manzini', 'M', 'inscrito', 16),
    ('Edson Roberto Macena de Britto Junior', 'M', 'espera', 17),
    ('Lucas Hartmann de Castro', 'M', 'espera', 18),
    ('Sergio Flor', 'M', 'espera', 19),
    ('André Migliaccio', 'M', 'espera', 20),
    ('Rubens Cox de Moura Leite', 'M', 'espera', 21),
    ('Francisco Ricardo de Medeiros Carneiro', 'M', 'espera', 22),
    ('Theo Stouthandel Rodil', 'M', 'espera', 23),
    ('Rodolfo Reis Morales', 'M', 'espera', 24),
    ('Daniel Pinheiro de Andrade', 'M', 'espera', 25),
    ('Otávio Ferreira da Silveira', 'M', 'espera', 26),
    ('Ricardo de Almeida Prado Fakhoury', 'M', 'espera', 27),
    ('Rodrigo Souza Mendes de Araujo', 'M', 'espera', 28),
    ('Bruno Bartholi', 'M', 'espera', 29),
    ('Guilherme Henrique Lima', 'M', 'espera', 30),
    ('Daniel de Paula Moraes', 'M', 'espera', 31),
    ('João de Lacerda Soares', 'M', 'espera', 32),
    ('João Henrique Cunha de Almeida', 'M', 'espera', 33),
    ('Mario Marchetti', 'M', 'espera', 34),
    ('Luciano Faustino', 'M', 'espera', 35),
    ('Marcos Steuer', 'M', 'espera', 36),
    ('Paul Klein', 'M', 'espera', 37),
    ('Frederico Pessoa Porto', 'M', 'espera', 38),
    ('Giacomo Santos', 'M', 'espera', 39),
    ('Antônio Martins Guido Rios', 'M', 'espera', 40),
    ('Enzo Dias Menezes', 'M', 'espera', 41),
    ('Thiago Hanai', 'M', 'espera', 42),
    ('Bruno Poljokan', 'M', 'espera', 43)
  ) as x(nome, genero, situacao, ordem);
end $$;

notify pgrst, 'reload schema';
