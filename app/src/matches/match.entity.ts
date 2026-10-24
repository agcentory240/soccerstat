import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

@Entity('matches')
export class MatchEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar' })
  country: string;

  @Column({ type: 'varchar' })
  league: string;

  @Index({ unique: true })
  @Column({ type: 'varchar' })
  url: string;

  @Column({ type: 'timestamp' })
  dateTime: Date;

  @Column({ type: 'varchar' })
  homeTeam: string;

  @Column({ type: 'varchar' })
  awayTeam: string;

  @Column({ type: 'varchar', nullable: true })
  score: string | null;

  @Column({ type: 'varchar', nullable: true })
  liveTime: string | null;

  @Column({ type: 'boolean', default: false })
  marked: boolean;

  @Column({ type: 'boolean', default: false })
  ready: boolean;

  @Column({ type: 'boolean', default: false })
  selected: boolean;

  @Column({ type: 'varchar', nullable: true })
  info: string | null;

  @Column({ type: 'varchar', nullable: true })
  reason: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  oddsHome: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  oddsDraw: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  oddsAway: string | null;

  @Index()
  @Column({ type: 'smallint', nullable: true })
  aiScore: number | null;

  // 🆕 Причина оценки (объяснение от ИИ)
  @Column({ type: 'varchar', length: 255, nullable: true })
  aiReason: string | null; 

  // 🆕 Рекомендуемый рынок от ИИ
  @Column({ type: 'varchar', length: 50, nullable: true })
  aiMarket: string | null;

// ===== 🆕 ДЕТАЛЬНЫЙ АНАЛИЗ ОТ DEEPSEEK PRO =====

  @Index()
  @Column({ type: 'boolean', default: false })
  deepAnalyzed: boolean;  // прошёл ли глубокий анализ

  @Index()
  @Column({ type: 'varchar', length: 20, nullable: true })
  finalDecision: string | null;  // 'СТАВИТЬ' | 'ПРОПУСТИТЬ' | 'НАБЛЮДАТЬ'

  @Column({ type: 'varchar', length: 50, nullable: true })
  mainBet: string | null;  // 'ТМ (2.5)'

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  betCoefficient: string | null;  // 1.71

  @Column({ type: 'decimal', precision: 5, scale: 4, nullable: true })
  confidence: string | null;  // 0.7800

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  expectedValue: string | null;  // +8.20

  @Column({ type: 'varchar', length: 50, nullable: true })
  stakeRecommendation: string | null;  // '2-3% банка'

  @Column({ type: 'text', nullable: true })
  deepReasoning: string | null;  // текстовое обоснование

  @Column({ type: 'text', nullable: true })
  summary: string | null;  // краткое резюме

  // Полный JSON-ответ (для аудита и гибкости)
  @Column({ type: 'jsonb', nullable: true })
  deepAnalysis: Record<string, any> | null;

  @Column({ type: 'timestamp', nullable: true })
  deepAnalyzedAt: Date | null;
  
  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;
}