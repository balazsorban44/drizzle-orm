import { type Connection as CallbackConnection, type Pool as CallbackPool } from 'mysql2';
import { entityKind } from '~/entity';
import type { Logger } from '~/logger';
import { DefaultLogger } from '~/logger';
import { MySqlDialect } from '~/mysql-core/dialect';
import type { Mode } from '~/mysql-core/session';
import {
	createTableRelationsHelpers,
	extractTablesRelationalConfig,
	type RelationalSchemaConfig,
	type TablesRelationalConfig,
} from '~/relations';
import { type DrizzleConfig } from '~/utils';
import { DrizzleError } from '..';
import { MySqlDatabase } from '.';
import type { MySql2Client, MySql2PreparedQueryHKT, MySql2QueryResultHKT } from './session';
import { MySql2Session } from './session';

export interface MySqlDriverOptions {
	logger?: Logger;
}

export class MySql2Driver {
	static readonly [entityKind]: string = 'MySql2Driver';

	constructor(
		private client: MySql2Client,
		private dialect: MySqlDialect,
		private options: MySqlDriverOptions = {},
	) {
	}

	createSession(
		schema: RelationalSchemaConfig<TablesRelationalConfig> | undefined,
		mode: Mode,
	): MySql2Session<Record<string, unknown>, TablesRelationalConfig> {
		return new MySql2Session(this.client, this.dialect, schema, { logger: this.options.logger, mode });
	}
}

export { MySqlDatabase } from '~/mysql-core/db';

export type MySql2Database<
	TSchema extends Record<string, unknown> = Record<string, never>,
> = MySqlDatabase<MySql2QueryResultHKT, MySql2PreparedQueryHKT, TSchema>;

export type MySql2DrizzleConfig<TSchema extends Record<string, unknown> = Record<string, never>> =
	& Omit<DrizzleConfig<TSchema>, 'schema'>
	& ({ schema: TSchema; mode: Mode } | { schema?: undefined; mode?: Mode });

export function drizzle<TSchema extends Record<string, unknown> = Record<string, never>>(
	client: MySql2Client | CallbackConnection | CallbackPool,
	config: MySql2DrizzleConfig<TSchema> = {},
): MySql2Database<TSchema> {
	const dialect = new MySqlDialect();
	let logger;
	if (config.logger === true) {
		logger = new DefaultLogger();
	} else if (config.logger !== false) {
		logger = config.logger;
	}
	if (isCallbackClient(client)) {
		client = client.promise();
	}

	let schema: RelationalSchemaConfig<TablesRelationalConfig> | undefined;
	if (config.schema) {
		if (config.mode === undefined) {
			throw new DrizzleError(
				'You need to specify "mode": "planetscale" or "default" when providing a schema. Read more: https://orm.drizzle.team/docs/rqb#modes',
			);
		}

		const tablesConfig = extractTablesRelationalConfig(
			config.schema,
			createTableRelationsHelpers,
		);
		schema = {
			fullSchema: config.schema,
			schema: tablesConfig.tables,
			tableNamesMap: tablesConfig.tableNamesMap,
		};
	}

	const mode = config.mode ?? 'default';

	const driver = new MySql2Driver(client as MySql2Client, dialect, { logger });
	const session = driver.createSession(schema, mode);
	return new MySqlDatabase(dialect, session, schema, mode) as MySql2Database<TSchema>;
}

interface CallbackClient {
	promise(): MySql2Client;
}

function isCallbackClient(client: any): client is CallbackClient {
	return typeof client.promise === 'function';
}
