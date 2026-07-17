-- The builtin Research agent learns search_web (added to the tool catalog in
-- this release). One-time UPDATE: the TS seed is INSERT OR IGNORE, so
-- existing DBs never pick up seed changes. Scoped to is_builtin so a user
-- who renamed/duplicated it isn't touched.

UPDATE agents SET
    tools_json = '["search_web","fetch_url"]',
    description = 'Searches the web and reads pages. Use for anything that needs current outside information — news, docs, prices, or a specific URL.'
    WHERE id = 'agt_research' AND is_builtin = 1;
