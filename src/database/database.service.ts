import { Injectable, OnModuleDestroy } from "@nestjs/common";
import mysql, {
  type Pool,
  type ResultSetHeader,
  type RowDataPacket
} from "mysql2/promise";

type QueryParam = string | number | boolean | Date | null;

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private readonly pool: Pool;

  constructor() {
    this.pool = mysql.createPool({
      host: process.env.DB_HOST ?? "127.0.0.1",
      port: toPort(process.env.DB_PORT, 3307),
      user: process.env.DB_USER ?? "price_watch",
      password: process.env.DB_PASSWORD ?? "price_watch_dev",
      database: process.env.DB_NAME ?? "price_watch",
      waitForConnections: true,
      connectionLimit: toPort(process.env.DB_CONNECTION_LIMIT, 10),
      queueLimit: 0,
      timezone: "Z"
    });
  }

  async queryRows<T extends RowDataPacket[]>(
    sql: string,
    params: QueryParam[] = []
  ): Promise<T> {
    const [rows] = await this.pool.query<T>(sql, params);
    return rows;
  }

  async execute(sql: string, params: QueryParam[] = []): Promise<ResultSetHeader> {
    const [result] = await this.pool.execute<ResultSetHeader>(sql, params);
    return result;
  }

  async withTransaction<T>(
    action: (connection: {
      queryRows<R extends RowDataPacket[]>(
        sql: string,
        params?: QueryParam[]
      ): Promise<R>;
      execute(sql: string, params?: QueryParam[]): Promise<ResultSetHeader>;
    }) => Promise<T>
  ): Promise<T> {
    const connection = await this.pool.getConnection();

    try {
      await connection.beginTransaction();

      const result = await action({
        queryRows: async <R extends RowDataPacket[]>(
          sql: string,
          params: QueryParam[] = []
        ) => {
          const [rows] = await connection.query<R>(sql, params);
          return rows;
        },
        execute: async (sql: string, params: QueryParam[] = []) => {
          const [queryResult] = await connection.execute<ResultSetHeader>(sql, params);
          return queryResult;
        }
      });

      await connection.commit();
      return result;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}

function toPort(input: string | undefined, fallback: number): number {
  const parsed = Number(input);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}
