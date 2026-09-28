/**
 * Dumps every table in the public schema as { tableName: rows[] }.
 * Tables are sorted by name and rows by primary key so the output is stable.
 */
export async function dumpDatabase(db) {
  const { rows: tables } = await db.query(`
    SELECT t.table_name,
           COALESCE(
             (SELECT array_agg(k.column_name::text ORDER BY k.ordinal_position)
                FROM information_schema.table_constraints c
                JOIN information_schema.key_column_usage k
                  ON k.constraint_name = c.constraint_name AND k.table_schema = c.table_schema
               WHERE c.table_schema = t.table_schema
                 AND c.table_name = t.table_name
                 AND c.constraint_type = 'PRIMARY KEY'),
             ARRAY[]::text[]) AS pk
      FROM information_schema.tables t
     WHERE t.table_schema = 'public' AND t.table_type = 'BASE TABLE'
     ORDER BY t.table_name`);

  const dump = {};
  for (const { table_name, pk } of tables) {
    const orderBy = pk.length ? ` ORDER BY ${pk.map((c) => `"${c}"`).join(', ')}` : '';
    const { rows } = await db.query(`SELECT * FROM "${table_name}"${orderBy}`);
    // Round-trip through JSON so Dates become ISO strings, exactly like the dump file.
    dump[table_name] = JSON.parse(JSON.stringify(rows));
  }
  return dump;
}
