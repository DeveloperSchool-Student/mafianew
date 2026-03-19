import type { TFunction } from 'i18next';

export function getPhaseLabel(phase: string | null, t: TFunction): string {
    switch (phase) {
        case 'ROLE_DISTRIBUTION': return t('game.phase_ROLE_DISTRIBUTION', 'РОЗПОДІЛ РОЛЕЙ');
        case 'NIGHT': return t('game.phase_NIGHT');
        case 'DAY_DISCUSSION': return t('game.phase_DAY_DISCUSSION');
        case 'DAY_VOTING': return t('game.phase_DAY_VOTING');
        case 'MAYOR_VETO': return t('game.phase_MAYOR_VETO', 'ВЕТО МЕРА');
        case 'END_GAME': return t('game.phase_END_GAME');
        default: return phase || t('game.unknown');
    }
}

export function getRoleLabel(role: string | null, t: TFunction): string {
    switch (role) {
        case 'MAFIA': return t('game.role_MAFIA');
        case 'DON': return t('game.role_DON');
        case 'DOCTOR': return t('game.role_DOCTOR');
        case 'SHERIFF': return t('game.role_SHERIFF');
        case 'ESCORT': return t('game.role_WHORE');
        case 'SERIAL_KILLER': return t('game.role_SERIAL_KILLER');
        case 'JESTER': return t('game.role_JESTER');
        case 'CITIZEN': return t('game.role_CITIZEN');
        case 'LAWYER': return t('game.role_LAWYER', 'АДВОКАТ');
        case 'BODYGUARD': return t('game.role_BODYGUARD', 'ОХОРОНЕЦЬ');
        case 'TRACKER': return t('game.role_TRACKER', 'СЛІДОПИТ');
        case 'INFORMER': return t('game.role_INFORMER', 'ІНФОРМАТОР');
        case 'MAYOR': return t('game.role_MAYOR', 'МЕР');
        case 'JUDGE': return t('game.role_JUDGE', 'СУДДЯ');
        case 'BOMBER': return t('game.role_BOMBER', 'ПІДРИВНИК');
        case 'TRAPPER': return t('game.role_TRAPPER', 'ТРАПЕР');
        case 'SILENCER': return t('game.role_SILENCER', 'ГЛУШУВАЧ');
        case 'LOVERS': return t('game.role_LOVERS', 'КОХАНЦІ');
        case 'WHORE': return t('game.role_WHORE', 'ПОВІЯ');
        case 'JOURNALIST': return t('game.role_JOURNALIST', 'ЖУРНАЛІСТ');
        default: return role || t('game.unknown');
    }
}

export function getRoleColor(role: string | null): string {
    if (role === 'MAFIA' || role === 'DON') return '#ef4444';
    if (role === 'SHERIFF') return '#eab308';
    if (role === 'JESTER') return '#f472b6';
    if (role === 'SERIAL_KILLER') return '#a855f7';
    return '#60a5fa';
}

export function getBgColor(phase: string | null): string {
    if (!phase) return '#0d0d0d';
    if (phase === 'NIGHT') return '#050505';
    if (phase === 'DAY_DISCUSSION' || phase === 'DAY_VOTING') return '#1a1a1a';
    if (phase === 'END_GAME') return '#101910';
    return '#0d0d0d';
}
