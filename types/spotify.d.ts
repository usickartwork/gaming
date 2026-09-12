// Spotify Web Playback SDK Types

export interface SpotifyPlayerCallback {
  (instance: { device_id: string }): void
}

export interface SpotifyPlayerErrorCallback {
  (instance: { message: string }): void
}

export interface SpotifyPlaybackTrack {
  id: string
  uri: string
  name: string
  artists: Array<{ name: string; uri: string }>
  album: {
    name: string
    images: Array<{ url: string }>
  }
}

export interface SpotifyPlaybackState {
  paused: boolean
  position: number
  duration: number
  track_window: {
    current_track: SpotifyPlaybackTrack
  }
}

export interface SpotifyPlayerInstance {
  connect(): Promise<boolean>
  disconnect(): void
  addListener(event: 'ready' | 'not_ready', cb: SpotifyPlayerCallback): boolean
  addListener(
    event: 'initialization_error' | 'authentication_error' | 'account_error' | 'playback_error',
    cb: SpotifyPlayerErrorCallback
  ): boolean
  addListener(
    event: 'player_state_changed',
    cb: (state: SpotifyPlaybackState | null) => void
  ): boolean
  removeListener(event: string, cb?: (...args: any[]) => void): boolean
  getCurrentState(): Promise<SpotifyPlaybackState | null>
  setName(name: string): Promise<void>
  getVolume(): Promise<number>
  setVolume(volume: number): Promise<void>
  pause(): Promise<void>
  resume(): Promise<void>
  togglePlay(): Promise<void>
  seek(position_ms: number): Promise<void>
  previousTrack(): Promise<void>
  nextTrack(): Promise<void>
}

declare global {
  interface Window {
    onSpotifyWebPlaybackSDKReady?: () => void
    Spotify?: {
      Player: new (options: {
        name: string
        getOAuthToken: (cb: (token: string) => void) => void
        volume?: number
      }) => SpotifyPlayerInstance
    }
  }
}
