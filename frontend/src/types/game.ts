// ===========================
// Game Type Definitions
// ===========================

/** All possible game phases */
export type GamePhase =
    | 'ROLE_DISTRIBUTION'
    | 'NIGHT'
    | 'DAY_DISCUSSION'
    | 'DAY_VOTING'
    | 'MAYOR_VETO'
    | 'END_GAME';

/** All possible game roles */
export type GameRole =
    | 'MAFIA'
    | 'DON'
    | 'DOCTOR'
    | 'SHERIFF'
    | 'ESCORT'
    | 'SERIAL_KILLER'
    | 'JESTER'
    | 'CITIZEN'
    | 'LAWYER'
    | 'BODYGUARD'
    | 'TRACKER'
    | 'INFORMER'
    | 'MAYOR'
    | 'JUDGE'
    | 'BOMBER'
    | 'TRAPPER'
    | 'SILENCER'
    | 'LOVERS'
    | 'WHORE'
    | 'JOURNALIST';

/** Night action types mapped from roles */
export type NightActionType =
    | 'KILL'
    | 'CHECK_DON'
    | 'HEAL'
    | 'CHECK'
    | 'BLOCK'
    | 'KILL_SERIAL'
    | 'DEFEND'
    | 'GUARD'
    | 'TRACK'
    | 'INFORM'
    | 'BOMB'
    | 'TRAP'
    | 'SILENCE'
    | 'COMPARE';

/** Mapping from role to default night action */
export const ROLE_ACTION_MAP: Partial<Record<GameRole, NightActionType>> = {
    MAFIA: 'KILL',
    DOCTOR: 'HEAL',
    SHERIFF: 'CHECK',
    ESCORT: 'BLOCK',
    SERIAL_KILLER: 'KILL_SERIAL',
    LAWYER: 'DEFEND',
    BODYGUARD: 'GUARD',
    TRACKER: 'TRACK',
    INFORMER: 'INFORM',
    BOMBER: 'BOMB',
    TRAPPER: 'TRAP',
    SILENCER: 'SILENCE',
    WHORE: 'BLOCK',
    JOURNALIST: 'COMPARE',
    // DON uses donMode — handled separately
};

/** A player in the game */
export interface Player {
    userId: string;
    username: string;
    isAlive: boolean;
    isSpectator?: boolean;
    isOnline?: boolean;
    role?: GameRole | string | null;
    staffRoleTitle?: string | null;
    staffRoleColor?: string | null;
    lastWill?: string | null;
    isBot?: boolean;
}

/** A vote cast during DAY_VOTING */
export interface Vote {
    voterId: string;
    targetId: string;
}

/** A spectator/dead bet */
export interface Bet {
    userId: string;
    faction: string;
    amount: number;
}

/** Chat message with optional staff role styling */
export interface ChatMessage {
    id: string;
    sender: string;
    text: string;
    type: 'system' | 'general' | 'mafia' | 'dead' | 'lobby';
    staffRoleTitle?: string;
    staffRoleColor?: string;
}
