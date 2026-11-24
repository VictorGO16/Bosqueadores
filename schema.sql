CREATE TABLE IF NOT EXISTS bosque_web_room (
 id integer PRIMARY KEY CHECK(id=1), owner text, token_hash text, started timestamptz,
 head jsonb, history jsonb NOT NULL DEFAULT '[]', receipt jsonb
);
INSERT INTO bosque_web_room(id) VALUES(1) ON CONFLICT DO NOTHING;
