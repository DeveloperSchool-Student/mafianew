export class AudioManager {
    private static instance: AudioManager;
    private sounds: Map<string, HTMLAudioElement> = new Map();
    
    // Paths for sound assets
    private soundPaths: Record<string, string> = {
        'bg-music': '/sounds/bg-music.mp3',
        'night-ambient': '/sounds/night.mp3',
        'shot': '/sounds/shot.mp3',
        'click': '/sounds/click.mp3',
        'phase-change': '/sounds/phase-change.mp3',
        'victory': '/sounds/victory.mp3',
        'defeat': '/sounds/defeat.mp3',
        'notification': '/sounds/notification.mp3',
    };

    private volume: number = 0.5;
    private sfxVolume: number = 1.0;
    private isMuted: boolean = false;

    private constructor() {
        // Initialize basic sounds
        Object.entries(this.soundPaths).forEach(([key, path]) => {
            const audio = new Audio(path);
            if (key === 'bg-music' || key === 'night-ambient') {
                audio.loop = true;
            }
            this.sounds.set(key, audio);
        });

        this.loadSettings();
        this.updateVolume();
    }

    public static getInstance(): AudioManager {
        if (!AudioManager.instance) {
            AudioManager.instance = new AudioManager();
        }
        return AudioManager.instance;
    }

    private loadSettings() {
        const savedVolume = localStorage.getItem('mafia_volume');
        const savedMuted = localStorage.getItem('mafia_muted');

        if (savedVolume !== null) this.volume = parseFloat(savedVolume);
        if (savedMuted !== null) this.isMuted = savedMuted === 'true';
    }

    private saveSettings() {
        localStorage.setItem('mafia_volume', this.volume.toString());
        localStorage.setItem('mafia_muted', this.isMuted.toString());
    }

    private updateVolume() {
        const effectiveVolume = this.isMuted ? 0 : this.volume;
        
        this.sounds.forEach((audio, key) => {
            if (key === 'bg-music') {
                audio.volume = effectiveVolume * 0.4; // 40% of master for music
            } else if (key === 'night-ambient') {
                audio.volume = effectiveVolume * 0.6; // 60% for ambient
            } else {
                audio.volume = effectiveVolume * this.sfxVolume; // 100% of master for SFX
            }
        });
    }

    public setVolume(volume: number) {
        this.volume = Math.max(0, Math.min(1, volume));
        this.saveSettings();
        this.updateVolume();
    }

    public getVolume(): number {
        return this.volume;
    }

    public toggleMute() {
        this.isMuted = !this.isMuted;
        this.saveSettings();
        this.updateVolume();
    }

    public isAudioMuted(): boolean {
        return this.isMuted;
    }

    /**
     * Play a sound by its key defined in soundPaths
     */
    public play(key: string, restart = true) {
        const audio = this.sounds.get(key);
        if (!audio || this.isMuted) return;

        if (restart) {
            audio.currentTime = 0;
        }
        
        audio.play().catch(() => {
            // User interaction might be required
            // We silent this because it's expected in many browsers
        });
    }

    public stop(key: string) {
        const audio = this.sounds.get(key);
        if (audio) {
            audio.pause();
            audio.currentTime = 0;
        }
    }

    // Sugar methods for common actions
    public playClick() { this.play('click'); }
    public playShot() { this.play('shot'); }
    public playPhaseChange() { this.play('phase-change'); }
    public playNotification() { this.play('notification'); }
    public playVictory() { this.play('victory'); }
    public playDefeat() { this.play('defeat'); }

    public startMusic() { this.play('bg-music', false); }
    public stopMusic() { this.stop('bg-music'); }

    public startNight() { this.play('night-ambient', false); }
    public stopNight() { this.stop('night-ambient'); }
}

export const audioManager = AudioManager.getInstance();
