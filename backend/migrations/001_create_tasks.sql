CREATE TABLE tasks (
  id         integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  title      varchar(200) NOT NULL CHECK (length(btrim(title)) > 0),
  done       boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX tasks_created_at_idx ON tasks (created_at DESC);
