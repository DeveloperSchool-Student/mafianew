export enum GamePhase {
  WAITING_LOBBY = 'WAITING_LOBBY',
  ROLE_DISTRIBUTION = 'ROLE_DISTRIBUTION',
  NIGHT = 'NIGHT',
  DAY_DISCUSSION = 'DAY_DISCUSSION',
  DAY_VOTING = 'DAY_VOTING',
  MAYOR_VETO = 'MAYOR_VETO',
  COURT = 'COURT',
  EXECUTION = 'EXECUTION',
  END_GAME = 'END_GAME',
}

export enum RoleType {
  CITIZEN = 'CITIZEN',
  MAFIA = 'MAFIA',
  DON = 'DON',
  SHERIFF = 'SHERIFF',
  DOCTOR = 'DOCTOR',
  LOVERS = 'LOVERS',
  SERIAL_KILLER = 'SERIAL_KILLER',
  LAWYER = 'LAWYER',
  ESCORT = 'ESCORT',
  BODYGUARD = 'BODYGUARD',
  TRACKER = 'TRACKER',
  INFORMER = 'INFORMER',
  MAYOR = 'MAYOR',
  JUDGE = 'JUDGE',
  JESTER = 'JESTER',
  BOMBER = 'BOMBER',
  TRAPPER = 'TRAPPER',
  SILENCER = 'SILENCER',
  WHORE = 'WHORE',
  JOURNALIST = 'JOURNALIST',
}

export interface PlayerState {
  userId: string;
  username: string;
  role: RoleType | null;
  isAlive: boolean;
  canUseAction: boolean;
  disconnectTimer?: NodeJS.Timeout | null;
  lastWill?: string;
  isSpectator?: boolean;
  isBot?: boolean;
  afkPhasesCount?: number;
  isSilenced?: boolean;
  isOnline?: boolean;
  staffRoleKey?: string | null;
  staffRoleTitle?: string | null;
  staffRoleColor?: string | null;
}

export interface MatchLog {
  day: number;
  phase: string;
  text: string;
}

export interface GameState {
  roomId: string;
  phase: GamePhase;
  players: PlayerState[];
  timerMs: number;
  dayCount: number;
  nightActions: Map<string, any>;
  votes: Map<string, string>;
  bets: Map<string, { faction: string; amount: number }>;
  logs: MatchLog[];
  mayorVetoUsed?: boolean;
  pendingExecutionId?: string | null;
}

export interface Room {
  id: string;
  hostId: string;
  type?: 'CASUAL' | 'RANKED' | 'TOURNAMENT';
  players: {
    userId: string;
    username: string;
    isReady: boolean;
    level?: number;
    avatarUrl?: string;
    isBot?: boolean;
  }[];
  status: 'WAITING_LOBBY' | 'IN_PROGRESS';
  settings?: {
    dayTimerMs: number;
    nightTimerMs: number;
    enableSerialKiller: boolean;
    enableEscort: boolean;
    enableJester: boolean;
    enableLawyer?: boolean;
    enableBodyguard?: boolean;
    enableTracker?: boolean;
    enableInformer?: boolean;
    enableMayor?: boolean;
    enableJudge?: boolean;
    enableBomber?: boolean;
    enableTrapper?: boolean;
    enableSilencer?: boolean;
    enableLovers?: boolean;
    enableWhore?: boolean;
    enableJournalist?: boolean;
  };
}
