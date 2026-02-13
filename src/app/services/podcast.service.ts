import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

/**
 * ממשק מצב הנגן המשותף
 */
export interface PodcastState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  progress: number;
  isMuted: boolean;
  playbackRate: number;
  expanded?: boolean;
}

/**
 * שירות לניהול נגן הפודקסט
 * מאפשר שיתוף מצב הנגן בין קומפוננטות שונות
 */
@Injectable({
  providedIn: 'root'
})
export class PodcastService {
  
  // נושא התנהגותי למצב הנגן הנוכחי
  private _podcastState = new BehaviorSubject<PodcastState>({
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    progress: 0,
    isMuted: false,
    playbackRate: 1,
    expanded: false
  });
  
  // נתיב לקובץ האודיו
  private _podcastFilePath = '/assets/audio/system-podcast.mp3';
  
  // השהייה כאשר מבצעים פעולות מחוץ לקומפוננטה העיקרית
  private _debounceTimer: any = null;
  
  constructor() {
    // טעינת העדפות משתמש שנשמרו
    this.loadSavedPreferences();
  }
  
  /**
   * קבלת מצב הנגן הנוכחי כאובזרבבל
   */
  get podcastState$(): Observable<PodcastState> {
    return this._podcastState.asObservable();
  }
  
  /**
   * קבלת מצב הנגן הנוכחי
   */
  get currentState(): PodcastState {
    return this._podcastState.value;
  }
  
  /**
   * קבלת הנתיב לקובץ האודיו
   */
  get podcastFilePath(): string {
    return this._podcastFilePath;
  }
  
  /**
   * עדכון מצב הנגן
   */
  updateState(state: Partial<PodcastState>, savePreferences: boolean = true): void {
    // עדכון מצב הנגן
    this._podcastState.next({
      ...this._podcastState.value,
      ...state
    });
    
    // שמירת העדפות משתמש
    if (savePreferences) {
      this.savePreferences();
    }
  }
  
  /**
   * הפעלת האודיו
   */
  play(): void {
    this.updateState({ isPlaying: true });
  }
  
  /**
   * השהיית האודיו
   */
  pause(): void {
    this.updateState({ isPlaying: false });
  }
  
  /**
   * קפיצה לנקודה מסוימת
   */
  seekTo(time: number): void {
    if (time < 0) time = 0;
    
    // חישוב התקדמות יחסית אם הקובץ נטען
    if (this.currentState.duration > 0) {
      const progress = time / this.currentState.duration;
      this.updateState({ currentTime: time, progress });
    } else {
      // אם משך הקובץ לא ידוע, רק נעדכן את הזמן
      this.updateState({ currentTime: time });
    }
  }
  
  /**
   * קפיצה קדימה או אחורה ביחס למיקום הנוכחי
   */
  seekRelative(offset: number): void {
    const newTime = this.currentState.currentTime + offset;
    this.seekTo(newTime);
  }
  
  /**
   * החלפת מצב השתקה
   */
  toggleMute(): void {
    this.updateState({ isMuted: !this.currentState.isMuted });
  }
  
  /**
   * שינוי מהירות הניגון
   */
  setPlaybackRate(rate: number): void {
    if (rate > 0) {
      this.updateState({ playbackRate: rate });
    }
  }
  
  /**
   * החלפה מחזורית בין מהירויות ניגון נפוצות
   */
  cyclePlaybackRate(): void {
    const rates = [0.75, 1, 1.25, 1.5, 2];
    const currentIndex = rates.indexOf(this.currentState.playbackRate);
    const nextIndex = (currentIndex + 1) % rates.length;
    this.setPlaybackRate(rates[nextIndex]);
  }
  
  /**
   * הגדרת מסלול אודיו חדש
   */
  setPodcastFilePath(path: string): void {
    this._podcastFilePath = path;
    
    // איפוס נתוני הניגון
    this.resetPlayback();
  }
  
  /**
   * איפוס מצב הנגן בעת החלפת קובץ
   */
  private resetPlayback(): void {
    this.updateState({
      isPlaying: false,
      currentTime: 0,
      duration: 0,
      progress: 0
    });
  }
  
  /**
   * שמירת העדפות משתמש
   */
  private savePreferences(): void {
    // ביטול טיימר שמירה קודם
    if (this._debounceTimer) {
      clearTimeout(this._debounceTimer);
    }
    
    // יצירת טיימר חדש לשמירת העדפות
    this._debounceTimer = setTimeout(() => {
      const state = this.currentState;
      
      // שמירת מצב האם מורחב
      if (state.expanded !== undefined) {
        localStorage.setItem('podcast_expanded', state.expanded ? 'true' : 'false');
      }
      
      // שמירת מהירות ניגון
      localStorage.setItem('podcast_rate', state.playbackRate.toString());
      
      // שמירת מצב השתקה
      localStorage.setItem('podcast_muted', state.isMuted ? 'true' : 'false');
      
      // שמירת המיקום הנוכחי בפודקסט (רק אם הוא מתקדם מספיק)
      if (state.currentTime > 10) {
        localStorage.setItem('podcast_position', state.currentTime.toString());
      }
    }, 500);
  }
  
  /**
   * טעינת העדפות משתמש
   */
  private loadSavedPreferences(): void {
    const expanded = localStorage.getItem('podcast_expanded') === 'true';
    const playbackRate = parseFloat(localStorage.getItem('podcast_rate') || '1');
    const isMuted = localStorage.getItem('podcast_muted') === 'true';
    const currentTime = parseFloat(localStorage.getItem('podcast_position') || '0');
    
    // וידוא ערכים תקינים
    const safeRate = playbackRate > 0 ? playbackRate : 1;
    
    // עדכון המצב מההעדפות שנשמרו
    this.updateState({
      expanded,
      playbackRate: safeRate,
      isMuted,
      currentTime
    }, false);
  }
}