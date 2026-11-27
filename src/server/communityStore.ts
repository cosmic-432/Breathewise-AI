import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import type { CommunityChallenge, CommunityReport } from '../types/index.ts';

interface StoredChallenge {
  id: string;
  title: string;
  category: CommunityChallenge['category'];
  description: string;
  goalDescription: string;
  participantHashes: string[];
  actionsLoggedCount: number;
}

interface CommunityDatabase {
  challenges: StoredChallenge[];
  reports: CommunityReport[];
}

const DEFAULT_CHALLENGES: StoredChallenge[] = [
  {
    id: 'ch-reduce-solo-trips',
    title: 'Cut 2 Unnecessary Solo Vehicle Trips Weekly',
    category: 'transport',
    description:
      'Replace short solo car or two-wheeler trips with shared transit, carpooling, or remote alternatives where safe.',
    goalDescription: 'Collective voluntary goal: log genuine reduced solo trips across participating households.',
    participantHashes: [],
    actionsLoggedCount: 0,
  },
  {
    id: 'ch-combine-errands',
    title: 'Single-Loop Weekly Errand Consolidation',
    category: 'errands',
    description:
      'Batch grocery, pharmacy, and neighborhood errands into one planned trip to avoid repeated cold-start exhaust.',
    goalDescription: 'Combine at least 2 weekly errands into a single planned outing.',
    participantHashes: [],
    actionsLoggedCount: 0,
  },
  {
    id: 'ch-zero-waste-burning',
    title: 'Zero Open Leaf & Waste Burning Pledge',
    category: 'waste',
    description:
      'Commit to composting dry garden waste and using municipal collection instead of open burning during winter inversions.',
    goalDescription: 'Keep neighborhood breathing zones free of avoidable open-burn smoke.',
    participantHashes: [],
    actionsLoggedCount: 0,
  },
  {
    id: 'ch-household-energy',
    title: 'Smart Evening Electricity Trim',
    category: 'energy',
    description:
      'Use optimal AC/heating setpoints (24–26°C), switch off idle loads, and clean filters while preserving safe indoor air filtration.',
    goalDescription: 'Reduce avoidable evening peak electricity consumption without compromising health.',
    participantHashes: [],
    actionsLoggedCount: 0,
  },
];

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex').slice(0, 24);
}

/**
 * Privacy-respecting local file store for genuine community participation counts
 * and clearly labeled unverified user-submitted reports.
 * Never fabricates participation counts (starts at authentic 0 until users join).
 */
export class CommunityStore {
  private readonly filePath: string;
  private state: CommunityDatabase;

  constructor(baseDir: string = path.resolve(process.cwd(), 'data')) {
    const resolvedBase = path.resolve(baseDir);
    const candidate = path.resolve(resolvedBase, 'community.json');
    if (!candidate.startsWith(resolvedBase + path.sep)) {
      throw new Error('Invalid community storage path.');
    }
    this.filePath = candidate;
    this.state = this.load();
  }

  private load(): CommunityDatabase {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        const parsed = JSON.parse(raw) as Partial<CommunityDatabase>;
        if (Array.isArray(parsed.challenges) && Array.isArray(parsed.reports)) {
          return {
            challenges: parsed.challenges,
            reports: parsed.reports,
          };
        }
      }
    } catch {
      // Fall back to clean initial state if file is unreadable
    }
    return {
      challenges: DEFAULT_CHALLENGES.map((c) => ({
        ...c,
        participantHashes: [...c.participantHashes],
      })),
      reports: [],
    };
  }

  private persist(): void {
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const tempPath = `${this.filePath}.${process.pid}.${Date.now()}.tmp`;
    fs.writeFileSync(tempPath, JSON.stringify(this.state, null, 2), 'utf-8');
    fs.renameSync(tempPath, this.filePath);
  }

  getSummary(): {
    challenges: CommunityChallenge[];
    reports: CommunityReport[];
    totalVerifiedParticipants: number;
    totalLoggedActions: number;
  } {
    const challenges: CommunityChallenge[] = this.state.challenges.map((c) => ({
      id: c.id,
      title: c.title,
      category: c.category,
      description: c.description,
      goalDescription: c.goalDescription,
      participantsCount: c.participantHashes.length,
      actionsLoggedCount: c.actionsLoggedCount,
      verifiedNotice:
        'Live recorded count from voluntary participants on this BreatheWise instance (no fabricated figures).',
    }));

    const uniqueMembers = new Set<string>();
    let totalLoggedActions = 0;
    for (const c of this.state.challenges) {
      for (const h of c.participantHashes) uniqueMembers.add(h);
      totalLoggedActions += c.actionsLoggedCount;
    }

    return {
      challenges,
      reports: this.state.reports.slice(0, 40),
      totalVerifiedParticipants: uniqueMembers.size,
      totalLoggedActions,
    };
  }

  participate(
    challengeId: string,
    action: 'join' | 'log_action',
    clientToken: string,
  ): CommunityChallenge | null {
    const target = this.state.challenges.find((c) => c.id === challengeId);
    if (!target) return null;

    const hashed = hashToken(clientToken);
    if (!target.participantHashes.includes(hashed)) {
      target.participantHashes.push(hashed);
    }
    if (action === 'log_action') {
      target.actionsLoggedCount += 1;
    }
    this.persist();

    return {
      id: target.id,
      title: target.title,
      category: target.category,
      description: target.description,
      goalDescription: target.goalDescription,
      participantsCount: target.participantHashes.length,
      actionsLoggedCount: target.actionsLoggedCount,
      verifiedNotice:
        'Live recorded count from voluntary participants on this BreatheWise instance (no fabricated figures).',
    };
  }

  addReport(input: {
    areaLabel: string;
    category: CommunityReport['category'];
    title: string;
    description: string;
  }): CommunityReport {
    const report: CommunityReport = {
      id: `rep-${crypto.randomUUID().slice(0, 12)}`,
      areaLabel: input.areaLabel,
      category: input.category,
      title: input.title,
      description: input.description,
      createdAt: new Date().toISOString(),
      unverifiedUserReport: true,
    };
    this.state.reports.unshift(report);
    this.state.reports = this.state.reports.slice(0, 60);
    this.persist();
    return report;
  }

  resetForTests(): void {
    this.state = {
      challenges: DEFAULT_CHALLENGES.map((c) => ({
        ...c,
        participantHashes: [],
      })),
      reports: [],
    };
    this.persist();
  }
}
