export class AudioManager {
    private static instance: AudioManager;
    private bgMusic: HTMLAudioElement;
    private nightSound: HTMLAudioElement;
    private shotSound: HTMLAudioElement;

    // Default relative paths - user should place these files in public/sounds
    private bgMusicPath = '/sounds/bg-music.mp3';
    private nightSoundPath = '/sounds/night.mp3';
    private shotSoundPath = '/sounds/shot.mp3';

    private volume: number = 0.5;
    private isMuted: boolean = false;

    private constructor() {
        this.bgMusic = new Audio(this.bgMusicPath);
        this.bgMusic.loop = true;

        this.nightSound = new Audio(this.nightSoundPath);
        this.nightSound.loop = true;

        this.shotSound = new Audio(this.shotSoundPath);

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
        this.bgMusic.volume = effectiveVolume * 0.5; // BG music usually quieter
        this.nightSound.volume = effectiveVolume * 0.7;
        this.shotSound.volume = effectiveVolume;
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

    public playBgMusic() {
        if (this.bgMusic.paused) {
            this.bgMusic.play().catch(e => console.warn('Audio play prevented', e));
        }
    }

    public pauseBgMusic() {
        if (!this.bgMusic.paused) {
            this.bgMusic.pause();
        }
    }

    public playNightSound() {
        if (this.nightSound.paused) {
            this.nightSound.play().catch(e => console.warn('Audio play prevented', e));
        }
    }

    public pauseNightSound() {
        if (!this.nightSound.paused) {
            this.nightSound.pause();
        }
    }

    public playShotSound() {
        this.shotSound.currentTime = 0;
        this.shotSound.play().catch(e => console.warn('Audio play prevented', e));
    }
}

export const audioManager = AudioManager.getInstance();
