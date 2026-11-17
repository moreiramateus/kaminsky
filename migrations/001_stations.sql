CREATE TABLE IF NOT EXISTS estacoes (
  id uuid PRIMARY KEY,
  weatherlink_id uuid NOT NULL UNIQUE,
  nome varchar(150) NOT NULL CHECK (length(trim(nome)) > 0),
  habilitada boolean NOT NULL DEFAULT true,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);
