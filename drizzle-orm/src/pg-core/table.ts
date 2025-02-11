import type { BuildColumns } from '~/column-builder';
import { entityKind } from '~/entity';
import { Table, type TableConfig as TableConfigBase, type UpdateTableConfig } from '~/table';
import type { CheckBuilder } from './checks';
import type { AnyPgColumnBuilder, PgColumn, PgColumnBuilder } from './columns/common';
import type { ForeignKey, ForeignKeyBuilder } from './foreign-keys';
import type { AnyIndexBuilder } from './indexes';
import type { PrimaryKeyBuilder } from './primary-keys';
import type { UniqueConstraintBuilder } from './unique-constraint';

export type PgTableExtraConfig = Record<
	string,
	| AnyIndexBuilder
	| CheckBuilder
	| ForeignKeyBuilder
	| PrimaryKeyBuilder
	| UniqueConstraintBuilder
>;

export type TableConfig = TableConfigBase<PgColumn>;

/** @internal */
export const InlineForeignKeys = Symbol.for('drizzle:PgInlineForeignKeys');

export class PgTable<T extends TableConfig = TableConfig> extends Table<T> {
	static readonly [entityKind]: string = 'PgTable';

	/** @internal */
	static override readonly Symbol = Object.assign({}, Table.Symbol, {
		InlineForeignKeys: InlineForeignKeys as typeof InlineForeignKeys,
	});

	/**@internal */
	[InlineForeignKeys]: ForeignKey[] = [];

	/** @internal */
	override [Table.Symbol.ExtraConfigBuilder]: ((self: Record<string, PgColumn>) => PgTableExtraConfig) | undefined =
		undefined;
}

export type AnyPgTable<TPartial extends Partial<TableConfig> = {}> = PgTable<UpdateTableConfig<TableConfig, TPartial>>;

export type PgTableWithColumns<T extends TableConfig> =
	& PgTable<T>
	& {
		[Key in keyof T['columns']]: T['columns'][Key];
	};

/** @internal */
export function pgTableWithSchema<
	TTableName extends string,
	TSchemaName extends string | undefined,
	TColumnsMap extends Record<string, AnyPgColumnBuilder>,
>(
	name: TTableName,
	columns: TColumnsMap,
	extraConfig: ((self: BuildColumns<TTableName, TColumnsMap, 'pg'>) => PgTableExtraConfig) | undefined,
	schema: TSchemaName,
	baseName = name,
): PgTableWithColumns<{
	name: TTableName;
	schema: TSchemaName;
	columns: BuildColumns<TTableName, TColumnsMap, 'pg'>;
	dialect: 'pg';
}> {
	const rawTable = new PgTable<{
		name: TTableName;
		schema: TSchemaName;
		columns: BuildColumns<TTableName, TColumnsMap, 'pg'>;
		dialect: 'pg';
	}>(name, schema, baseName);

	const builtColumns = Object.fromEntries(
		Object.entries(columns).map(([name, colBuilder]) => {
			const column = colBuilder.build(rawTable);
			rawTable[InlineForeignKeys].push(...colBuilder.buildForeignKeys(column, rawTable));
			return [name, column];
		}),
	) as unknown as BuildColumns<TTableName, TColumnsMap, 'pg'>;

	const table = Object.assign(rawTable, builtColumns);

	table[Table.Symbol.Columns] = builtColumns;

	if (extraConfig) {
		table[PgTable.Symbol.ExtraConfigBuilder] = extraConfig as any;
	}

	return table;
}

export interface PgTableFn<TSchema extends string | undefined = undefined> {
	<
		TTableName extends string,
		TColumnsMap extends Record<string, PgColumnBuilder>,
	>(
		name: TTableName,
		columns: TColumnsMap,
		extraConfig?: (self: BuildColumns<TTableName, TColumnsMap, 'pg'>) => PgTableExtraConfig,
	): PgTableWithColumns<{
		name: TTableName;
		schema: TSchema;
		columns: BuildColumns<TTableName, TColumnsMap, 'pg'>;
		dialect: 'pg';
	}>;
}

export const pgTable: PgTableFn = (name, columns, extraConfig) => {
	return pgTableWithSchema(name, columns, extraConfig, undefined);
};

export function pgTableCreator(customizeTableName: (name: string) => string): PgTableFn {
	return (name, columns, extraConfig) => {
		return pgTableWithSchema(customizeTableName(name) as typeof name, columns, extraConfig, undefined, name);
	};
}
