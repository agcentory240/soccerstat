// Должен идти первым: TypeORM CLI читает process.env на этапе создания DataSource.
import './env.js';
import { DataSource } from 'typeorm';
import { MatchEntity } from './matches/match.entity.js';

export default new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: 5432,
  username: process.env.DB_USER || 'myuser',
  password: process.env.DB_PASSWORD || 'mypassword',
  database: process.env.DB_NAME || 'mydb',
  entities: [MatchEntity],
  migrations: ['src/migrations/*.ts'],
  synchronize: true,
});