-- "Ask everything" existed twice: as permission_level_id = NULL and as a
-- seeded builtin row with zero grants. Dropdowns listed both. NULL is the
-- single representation from now on.

UPDATE presets SET permission_level_id = NULL WHERE permission_level_id = 'lvl_ask_everything';
UPDATE chat_sessions SET permission_level_id = NULL WHERE permission_level_id = 'lvl_ask_everything';
UPDATE automations SET permission_level_id = NULL WHERE permission_level_id = 'lvl_ask_everything';
DELETE FROM permission_grants WHERE level_id = 'lvl_ask_everything';
DELETE FROM permission_levels WHERE id = 'lvl_ask_everything';
