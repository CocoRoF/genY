/**
 * AudioManager — Web Audio API 기반 TTS 오디오 재생 관리자
 *
 * 책임:
 *  - AudioContext 초기화 (사용자 인터랙션 후)
 *  - StreamingResponse → Blob → Audio 재생
 *  - Web Audio API: MediaElementSource → AnalyserNode → GainNode → destination
 *  - 진폭 콜백: requestAnimationFrame 루프에서 RMS 계산 (립싱크용)
 *  - 볼륨 제어: GainNode.gain 조절
 *  - stop / dispose
 */

export class AudioManager {
  private audioContext: AudioContext | null = null;
  private currentAudio: HTMLAudioElement | null = null;
  private gainNode: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private sourceNode: MediaElementAudioSourceNode | null = null;
  private onAmplitudeChange: ((amplitude: number) => void) | null = null;
  private animFrameId: number | null = null;
  private _volume: number = 0.7;

  /**
   * AudioContext 초기화 (사용자 인터랙션 후 호출 필요)
   */
  async init(): Promise<void> {
    if (this.audioContext) return;
    this.audioContext = new AudioContext();
    this.gainNode = this.audioContext.createGain();
    this.gainNode.gain.value = this._volume;
    this.gainNode.connect(this.audioContext.destination);

    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 256;
    this.analyser.smoothingTimeConstant = 0.8;
  }

  /**
   * TTS 스트리밍 오디오 재생
   * Response body를 Blob으로 변환 → Audio 엘리먼트 재생
   */
  async playTTSResponse(
    response: Response,
    onStart?: () => void,
    onEnd?: () => void,
  ): Promise<void> {
    await this.init();
    this.stop(); // 이전 재생 중지

    if (!response.ok || !response.body) {
      throw new Error(`TTS response error: ${response.status}`);
    }

    // 스트리밍 바디 → Blob
    const reader = response.body.getReader();
    const chunks: BlobPart[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
    const blob = new Blob(chunks, {
      type: response.headers.get('content-type') || 'audio/mpeg',
    });
    const url = URL.createObjectURL(blob);

    // Audio 엘리먼트 생성 및 Web Audio API 연결
    const audio = new Audio(url);
    this.currentAudio = audio;

    if (this.audioContext && this.analyser && this.gainNode) {
      this.sourceNode = this.audioContext.createMediaElementSource(audio);
      this.sourceNode.connect(this.analyser);
      this.analyser.connect(this.gainNode);
      this.startAmplitudeTracking();
    }

    audio.onplay = () => onStart?.();
    audio.onended = () => {
      this.stopAmplitudeTracking();
      onEnd?.();
      URL.revokeObjectURL(url);
    };
    audio.onerror = () => {
      this.stopAmplitudeTracking();
      onEnd?.();
      URL.revokeObjectURL(url);
    };

    await audio.play();
  }

  /**
   * 진폭 추적 시작 (립싱크용)
   */
  private startAmplitudeTracking(): void {
    if (!this.analyser) return;
    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);

    const track = () => {
      this.analyser!.getByteFrequencyData(dataArray);

      // RMS 계산
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += (dataArray[i] / 255) ** 2;
      }
      const rms = Math.sqrt(sum / dataArray.length);

      this.onAmplitudeChange?.(rms);
      this.animFrameId = requestAnimationFrame(track);
    };

    this.animFrameId = requestAnimationFrame(track);
  }

  /**
   * 진폭 추적 중지
   */
  private stopAmplitudeTracking(): void {
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    this.onAmplitudeChange?.(0); // 입 닫기
  }

  /** 립싱크 콜백 등록 */
  setAmplitudeCallback(cb: (amplitude: number) => void): void {
    this.onAmplitudeChange = cb;
  }

  /** 볼륨 설정 (0~1) */
  setVolume(vol: number): void {
    this._volume = Math.max(0, Math.min(1, vol));
    if (this.gainNode) {
      this.gainNode.gain.value = this._volume;
    }
  }

  /** 현재 볼륨 */
  get volume(): number {
    return this._volume;
  }

  /** AudioContext 접근 (Enhanced LipSync 초기화용) */
  getAudioContext(): AudioContext | null {
    return this.audioContext;
  }

  /** 현재 재생 중지 */
  stop(): void {
    this.stopAmplitudeTracking();
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.src = '';
      this.currentAudio = null;
    }
    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }
  }

  /** 재생 중 여부 */
  get isPlaying(): boolean {
    return this.currentAudio !== null && !this.currentAudio.paused;
  }

  /** 정리 */
  dispose(): void {
    this.stop();
    this.audioContext?.close();
    this.audioContext = null;
  }
}

// 싱글턴
let _audioManager: AudioManager | null = null;
export function getAudioManager(): AudioManager {
  if (!_audioManager) {
    _audioManager = new AudioManager();
  }
  return _audioManager;
}
