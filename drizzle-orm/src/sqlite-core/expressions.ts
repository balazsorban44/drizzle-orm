import { bindIfParam } from '~/expressions';
import type { SQL, SQLChunk, SQLWrapper } from '~/sql';
import { sql } from '~/sql';
import type { SQLiteColumn } from '~/sqlite-core/columns';

export * from '~/expressions';

export function concat(column: SQLiteColumn | SQL.Aliased, value: string | SQLWrapper): SQL {
	return sql`${column} || ${bindIfParam(value, column)}`;
}

export function substring(
	column: SQLiteColumn | SQL.Aliased,
	{ from, for: _for }: { from?: number | SQLWrapper; for?: number | SQLWrapper },
): SQL {
	const chunks: SQLChunk[] = [sql`substring(`, column];
	if (from !== undefined) {
		chunks.push(sql` from `, bindIfParam(from, column));
	}
	if (_for !== undefined) {
		chunks.push(sql` for `, bindIfParam(_for, column));
	}
	chunks.push(sql`)`);
	return sql.join(chunks);
}

export function rowId(): SQL<number> {
	return sql<number>`rowid`;
}
