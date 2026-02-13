import { CommonModule } from '@angular/common';
import { Component, ElementRef, NgZone, OnInit, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { finalize } from 'rxjs';
import { AdvisorService, ConversationListItem } from '../../services/advisor.service';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ChatMessage } from '../../models/chat-message.model';
import { PodcastService, PodcastState } from '../../services/podcast.service';

@Component({
  selector: 'app-conversation-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './conversation-list.component.html',
  styleUrls: ['./conversation-list.component.scss']
})
export class ConversationListComponent implements OnInit {
  @ViewChild('audioElement') audioElement!: ElementRef<HTMLAudioElement>;
  conversations: ConversationListItem[] = [];
  filteredConversations: ConversationListItem[] = [];
  isLoading: boolean = false;
  searchTerm: string = '';
  sortOrder: 'asc' | 'desc' = 'desc'; // ברירת מחדל - מהחדש לישן
  deleteConfirmationId: string | null = null;
  isDeleting: boolean = false;
  lastViewedConversation: string | null = null;
  // משתנים לעריכת כותרת
  editTitleId: string | null = null;
  newTitle: string = '';
  isUpdatingTitle: boolean = false;

  // משתנים לניהול מצב הנגן
  isPlaying: boolean = false;
  isMuted: boolean = false;
  progress: number = 0;
  currentTime: string = '00:00';
  duration: string = '00:00';
  playbackRate: number = 1;
  expanded: boolean = false;
  podcastFilePath: string = '';
  isDragging: boolean = false; // מצב גרירת מחוון


  constructor(
    private advisorService: AdvisorService,
    private router: Router,
    private sanitizer: DomSanitizer, private podcastService: PodcastService,private ngZone: NgZone) // הוספת הזרקת שירות
  { }

  /**
 * אתחול הקומפוננטה
 */
ngOnInit(): void {
  // טעינת רשימת השיחות
  this.loadConversations();
  
  // הגדרת נתיב הפודקסט הראשוני מהשירות
  this.podcastFilePath = this.podcastService.podcastFilePath;
  
  // טעינת מצב ראשוני מהשירות
  const state = this.podcastService.currentState;
  this.isPlaying = state.isPlaying;
  this.isMuted = state.isMuted;
  this.playbackRate = state.playbackRate;
  this.expanded = state.expanded || false;
  
  // המתנה ל-DOM לפני אתחול אלמנט האודיו
  // חשוב: צריך להמתין לרינדור של האלמנטים לפני גישה אליהם
  setTimeout(() => {
    // אתחול אלמנט האודיו והאירועים שלו
    this.setupAudioElement();
  }, 100);
}


  /**
 * אתחול והגדרת אלמנט האודיו והאירועים שלו
 */
  setupAudioElement(): void {
    if (!this.audioElement) {
      console.warn('אלמנט האודיו לא נמצא');
      return;
    }

    const audio = this.audioElement.nativeElement;

    // הגדרת מצב ראשוני
    audio.muted = this.isMuted;
    audio.playbackRate = this.playbackRate;

    // בדיקה אם הממשק בעברית והחלת התאמות RTL
    const isRtl = document.dir === 'rtl' ||
      document.documentElement.lang === 'he' ||
      document.documentElement.lang === 'ar';

    if (isRtl) {
      // וידוא שמחוון הטווח מתנהג כראוי בממשק RTL
      const rangeInput = this.audioElement.nativeElement.parentElement?.querySelector('input[type="range"]');
      if (rangeInput) {
        rangeInput.classList.add('rtl-range');
      }
    }

    // טעינת מטא-נתונים
    audio.addEventListener('loadedmetadata', () => {
      this.duration = this.formatTime(audio.duration);
      this.podcastService.updateState({
        duration: audio.duration
      });

      // קפיצה למיקום האחרון שנשמר
      const savedTime = this.podcastService.currentState.currentTime;
      if (savedTime > 0 && savedTime < audio.duration) {
        audio.currentTime = savedTime;
        this.updateProgress();
      }
    });

    // עדכון התקדמות
    audio.addEventListener('timeupdate', () => {
      this.updateProgress();
    });

    // טיפול בסיום ניגון
    audio.addEventListener('ended', () => {
      this.isPlaying = false;
      this.podcastService.pause();
    });

    // טיפול בשגיאות
    audio.addEventListener('error', (event) => {
      this.handleAudioError(event);
    });

    // אירוע של התחלת טעינה
    audio.addEventListener('loadstart', () => {
      console.log('התחלת טעינת קובץ האודיו');
    });

    // האודיו מוכן להתחיל לנגן
    audio.addEventListener('canplay', () => {
      console.log('האודיו מוכן לניגון');

      // אם היינו באמצע ניגון לפני החלפת קובץ, המשך לנגן
      if (this.podcastService.currentState.isPlaying) {
        audio.play().catch(err => {
          console.error('שגיאה בניגון אוטומטי:', err);
        });
      }
    });

    // מעקב אחרי שינויים מהשירות
    this.podcastService.podcastState$.subscribe(state => {
      this.handleServiceStateChange(state);
    });

    // התחל טעינת הקובץ
    audio.load();
  }

  /**
   * טיפול בשינויי מצב מהשירות
   */
  handleServiceStateChange(state: PodcastState): void {
    if (!this.audioElement) return;

    const audio = this.audioElement.nativeElement;

    // עדכון מצב ניגון
    if (state.isPlaying !== this.isPlaying) {
      this.isPlaying = state.isPlaying;
      if (this.isPlaying) {
        audio.play().catch(err => {
          console.error('שגיאה בניגון אודיו:', err);
          this.isPlaying = false;
          this.podcastService.pause();
        });
      } else {
        audio.pause();
      }
    }

    // עדכון מצב השתקה
    if (state.isMuted !== this.isMuted) {
      this.isMuted = state.isMuted;
      audio.muted = this.isMuted;
    }

    // עדכון מהירות ניגון
    if (state.playbackRate !== this.playbackRate && state.playbackRate > 0) {
      this.playbackRate = state.playbackRate;
      audio.playbackRate = this.playbackRate;
    }

    // עדכון מיקום רק אם לא גוררים כרגע
    if (!this.isDragging && Math.abs(state.progress - this.progress) > 0.01) {
      this.progress = state.progress;
      if (audio.duration) {
        audio.currentTime = this.progress * audio.duration;
        this.currentTime = this.formatTime(audio.currentTime);
      }
    }

    // עדכון מצב הרחבה
    if (state.expanded !== undefined && state.expanded !== this.expanded) {
      this.expanded = state.expanded;
    }

    // נגן בדיקה אם השירות שינה את הקובץ
    if (this.podcastFilePath !== this.podcastService.podcastFilePath) {
      this.podcastFilePath = this.podcastService.podcastFilePath;
      audio.load(); // טעינה מחדש של הקובץ החדש
    }
  }

  /**
   * טיפול בשגיאת טעינה של קובץ האודיו
   */
  handleAudioError(event: Event): void {
    console.error('שגיאה בטעינת קובץ האודיו:', event);

    // בדיקה מה סוג השגיאה
    const audio = this.audioElement?.nativeElement;
    let errorMessage = 'אירעה שגיאה בטעינת הפודקסט';

    if (audio && audio.error) {
      switch (audio.error.code) {
        case MediaError.MEDIA_ERR_ABORTED:
          errorMessage = 'ניגון הפודקסט בוטל על ידי המשתמש';
          break;
        case MediaError.MEDIA_ERR_NETWORK:
          errorMessage = 'אירעה שגיאת רשת בטעינת הפודקסט';
          break;
        case MediaError.MEDIA_ERR_DECODE:
          errorMessage = 'לא ניתן לפענח את קובץ הפודקסט';
          break;
        case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
          errorMessage = 'פורמט הפודקסט אינו נתמך או שהקובץ לא נמצא';
          break;
      }
    }

    // יש אפשרות להציג הודעת שגיאה למשתמש
    console.warn(errorMessage);

    // עדכון מצב הנגן
    this.isPlaying = false;
    this.podcastService.pause();
  }

  /**
 * פורמט זמן משניות לתצוגת MM:SS
 * @param timeInSeconds זמן בשניות
 * @returns מחרוזת בפורמט MM:SS
 */
  formatTime(timeInSeconds: number): string {
    if (isNaN(timeInSeconds) || timeInSeconds < 0) {
      return '00:00';
    }

    // חישוב דקות ושניות
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);

    // פורמט דו-ספרתי עם אפסים מובילים
    const formattedMinutes = minutes.toString().padStart(2, '0');
    const formattedSeconds = seconds.toString().padStart(2, '0');

    return `${formattedMinutes}:${formattedSeconds}`;
  }

  /**
   * גרסה מורחבת לפורמט HH:MM:SS לקבצים ארוכים
   * שימושית אם הפודקסט ארוך יותר משעה
   */
  formatLongTime(timeInSeconds: number): string {
    if (isNaN(timeInSeconds) || timeInSeconds < 0) {
      return '00:00:00';
    }

    // חישוב שעות, דקות ושניות
    const hours = Math.floor(timeInSeconds / 3600);
    const minutes = Math.floor((timeInSeconds % 3600) / 60);
    const seconds = Math.floor(timeInSeconds % 60);

    // פורמט דו-ספרתי עם אפסים מובילים
    const formattedHours = hours.toString().padStart(2, '0');
    const formattedMinutes = minutes.toString().padStart(2, '0');
    const formattedSeconds = seconds.toString().padStart(2, '0');

    // החזרת פורמט מתאים - עם או בלי שעות
    if (hours > 0) {
      return `${formattedHours}:${formattedMinutes}:${formattedSeconds}`;
    } else {
      return `${formattedMinutes}:${formattedSeconds}`;
    }
  }

  /**
 * קפיצה לנקודה מסוימת בזמן (בשניות)
 */
  seekTo(seconds: number): void {
    if (!this.audioElement) return;

    const audio = this.audioElement.nativeElement;

    // וידוא ערכים תקינים
    const safeSeconds = Math.min(Math.max(0, seconds), audio.duration || 0);

    // עדכון מיקום הניגון
    audio.currentTime = safeSeconds;

    // עדכון התקדמות
    if (audio.duration) {
      this.progress = safeSeconds / audio.duration;

      // עדכון השירות
      this.podcastService.updateState({
        currentTime: safeSeconds,
        progress: this.progress
      });
    }

    // הפעלת הניגון אם לא מתנגן
    if (!this.isPlaying) {
      this.togglePlayPause();
    }
  }

  /**
   * קפיצה יחסית קדימה או אחורה (בשניות)
   */
  seekRelative(offsetSeconds: number): void {
    if (!this.audioElement) return;

    const audio = this.audioElement.nativeElement;
    const newTime = Math.min(Math.max(0, audio.currentTime + offsetSeconds), audio.duration || 0);

    this.seekTo(newTime);
  }

  /**
   * עדכון מצב ההתקדמות עם גרירת המחוון - תמיכה ב-RTL
   */
  onProgressChange(): void {
    if (!this.audioElement) return;

    const audio = this.audioElement.nativeElement;

    if (audio.duration) {
      const newTime = this.progress * audio.duration;
      audio.currentTime = newTime;
      this.currentTime = this.formatTime(newTime);

      // סימון שהמשתמש מבצע גרירה
      this.isDragging = true;
    }
  }

  /**
   * עדכון מצב הנגן אחרי סיום גרירת המחוון
   */
  onProgressChangeEnd(): void {
    if (!this.audioElement) return;

    const audio = this.audioElement.nativeElement;

    if (audio.duration) {
      // עדכון השירות
      this.podcastService.updateState({
        currentTime: audio.currentTime,
        progress: this.progress
      });

      // סימון שהגרירה הסתיימה
      this.isDragging = false;
    }
  }

  /**
 * עדכון ההתקדמות בנגן - תיקון לתצוגת פס ההתקדמות
 */
updateProgress(): void {
  if (!this.audioElement) return;
  
  const audio = this.audioElement.nativeElement;
  
  // עדכון שורת ההתקדמות אם האודיו נטען ואין גרירה
  if (!isNaN(audio.duration) && audio.duration > 0 && !this.isDragging) {
    // חישוב יחס ההתקדמות
    this.progress = Math.max(0, Math.min(1, audio.currentTime / audio.duration));
    
    // וידוא שערך ההתקדמות נמצא בטווח 0-1
    if (isNaN(this.progress)) {
      this.progress = 0;
    }
    
    // עדכון ה-UI - בהכרח בזמן הרנדור הבא
    this.ngZone.run(() => {
      // לא צריך לעשות כלום כאן - זה יגרום לעדכון UI אוטומטי
    });
    
    // עדכון השירות רק אם המשתמש לא גורר את המחוון כרגע
    this.podcastService.updateState({
      currentTime: audio.currentTime,
      progress: this.progress
    }, true); // לא לשמור בכל עדכון (רק מדי פעם)
  }
  
  // עדכון תצוגת הזמן הנוכחי
  this.currentTime = this.formatTime(audio.currentTime);
  
  // עדכון משך הקובץ אם טרם נקבע
  if (this.duration === '00:00' && !isNaN(audio.duration) && audio.duration > 0) {
    this.duration = this.formatTime(audio.duration);
    this.podcastService.updateState({ duration: audio.duration });
  }
  
  // אנחנו מחייבים עדכון תצוגה מתמיד אם הקובץ מנוגן
  if (this.isPlaying) {
    requestAnimationFrame(() => this.updateProgress());
  }
}



  /**
   * הפעלה או השהייה של האודיו עם עדכון השירות
   */
  togglePlayPause(): void {
    if (!this.audioElement) return;

    if (this.isPlaying) {
      this.podcastService.pause();
    } else {
      this.podcastService.play();
    }
  }

  /**
   * הפעלה או השתקה של האודיו עם עדכון השירות
   */
  toggleMute(): void {
    if (!this.audioElement) return;

    const audio = this.audioElement.nativeElement;
    const newMuteState = !audio.muted;

    // עדכון מצב השתקה באלמנט
    audio.muted = newMuteState;

    // עדכון המצב המקומי
    this.isMuted = newMuteState;

    // עדכון השירות
    this.podcastService.updateState({
      isMuted: newMuteState
    });
  }

  /**
   * מעבר בין מהירויות ניגון שונות
   */
  cyclePlaybackRate(): void {
    if (!this.audioElement) return;

    // מחזוריות של מהירויות ניגון נפוצות
    const rates = [0.75, 1, 1.25, 1.5, 2];
    const currentIndex = rates.indexOf(this.playbackRate);
    const nextIndex = (currentIndex + 1) % rates.length;
    const newRate = rates[nextIndex];

    // עדכון מהירות ניגון באלמנט
    this.audioElement.nativeElement.playbackRate = newRate;

    // עדכון המצב המקומי
    this.playbackRate = newRate;

    // עדכון השירות
    this.podcastService.updateState({
      playbackRate: newRate
    });
  }

  /**
   * הרחבה או כיווץ של פרטי הפודקסט
   */
  toggleExpanded(): void {
    this.expanded = !this.expanded;

    // שמירת ההעדפה למקרה של טעינה מחדש
    localStorage.setItem('podcast_expanded', this.expanded ? 'true' : 'false');
  }


  /**
 * הוספת ל-conversation-list.component.ts
 * פונקציה לקביעת צבע הטקסט בהתאם לצבע הרקע
 * מבוסס על אלגוריתם חישוב ניגודיות (contrast)
 */

  /**
   * מחשב את צבע הטקסט המתאים (לבן או שחור) לפי צבע הרקע
   * @param advisorId מזהה היועץ שממנו נגזר צבע הרקע
   * @returns קלאס CSS של צבע הטקסט המתאים
   */
  getContrastText(advisorId: string): string {
    // מיפוי ערכי הבהירות (luminance) של צבעי הרקע של היועצים
    // ערכים גבוהים יותר = צבעים בהירים יותר, יקבלו טקסט כהה
    const luminanceMapping: Record<string, number> = {
      'strategy': 0.3,    // cyan-700 - כהה, צריך טקסט לבן
      'budget': 0.4,      // amber-700 - בינוני, צריך טקסט לבן
      'mortgage': 0.25,   // blue-600 - כהה, צריך טקסט לבן
      'investments': 0.4, // green-600 - בינוני, צריך טקסט לבן
      'pension': 0.2,     // purple-600 - כהה מאוד, צריך טקסט לבן
      'risk': 0.3,        // pink-600 - כהה, צריך טקסט לבן
      'behavior': 0.2,    // rose-600 - כהה, צריך טקסט לבן
      'selfemployed': 0.5, // yellow-600 - בהיר יחסית, אולי טקסט כהה
      'special': 0.45,    // orange-600 - בינוני, צריך טקסט לבן
      'data': 0.25,       // slate-600 - כהה, צריך טקסט לבן
      'career': 0.4,      // emerald-600 - בינוני, צריך טקסט לבן
      'meaning': 0.55,    // yellow-700 - בהיר יחסית, אולי טקסט כהה
      'abundance': 0.2,   // fuchsia-600 - כהה, צריך טקסט לבן
      'young': 0.35,      // cyan-600 - כהה, צריך טקסט לבן
      'altinvest': 0.5,   // lime-600 - בהיר יחסית, אולי טקסט כהה
      'intergen': 0.3,    // teal-700 - כהה, צריך טקסט לבן
      'altretire': 0.2    // red-600 - כהה, צריך טקסט לבן
    };

    // ערך סף להבחנה בין צבעי רקע כהים לבהירים
    const LUMINANCE_THRESHOLD = 0.5;

    // קבלת ערך הבהירות של צבע הרקע
    const luminance = luminanceMapping[advisorId] || 0.2; // ברירת מחדל לצבעים לא מוכרים

    // החזרת קלאס צבע הטקסט המתאים
    return luminance >= LUMINANCE_THRESHOLD ? 'text-gray-900' : 'text-white';
  }

  // גרסה משופרת יותר שמחשבת בהירות באופן דינמי לפי ערכי RGB
  getContrastTextDynamic(advisorId: string): string {
    // מיפוי צבעי RGB של היועצים
    const rgbMapping: Record<string, { r: number, g: number, b: number }> = {
      'strategy': { r: 14, g: 116, b: 144 },     // cyan-700
      'budget': { r: 180, g: 83, b: 9 },         // amber-700
      'mortgage': { r: 37, g: 99, b: 235 },      // blue-600
      'investments': { r: 22, g: 163, b: 74 },   // green-600
      'pension': { r: 147, g: 51, b: 234 },      // purple-600
      'risk': { r: 219, g: 39, b: 119 },         // pink-600
      'behavior': { r: 225, g: 29, b: 72 },      // rose-600 
      'selfemployed': { r: 202, g: 138, b: 4 },  // yellow-600
      'special': { r: 234, g: 88, b: 12 },       // orange-600
      'data': { r: 71, g: 85, b: 105 },          // slate-600
      'career': { r: 5, g: 150, b: 105 },        // emerald-600
      'meaning': { r: 161, g: 98, b: 7 },        // yellow-700
      'abundance': { r: 192, g: 38, b: 211 },    // fuchsia-600
      'young': { r: 8, g: 145, b: 178 },         // cyan-600
      'altinvest': { r: 101, g: 163, b: 13 },    // lime-600
      'intergen': { r: 15, g: 118, b: 110 },     // teal-700
      'altretire': { r: 220, g: 38, b: 38 }      // red-600
    };

    // ברירת מחדל לצבעים לא מוכרים
    const defaultRgb = { r: 75, g: 85, b: 99 }; // gray-600

    // קבלת ערכי RGB של צבע הרקע
    const rgb = rgbMapping[advisorId] || defaultRgb;

    // חישוב הבהירות לפי נוסחת WCAG
    // פרטים: https://www.w3.org/TR/WCAG20-TECHS/G17.html

    // המרה לערכים יחסיים
    const r = rgb.r / 255;
    const g = rgb.g / 255;
    const b = rgb.b / 255;

    // המרה ל-sRGB
    const R = r <= 0.03928 ? r / 12.92 : Math.pow((r + 0.055) / 1.055, 2.4);
    const G = g <= 0.03928 ? g / 12.92 : Math.pow((g + 0.055) / 1.055, 2.4);
    const B = b <= 0.03928 ? b / 12.92 : Math.pow((b + 0.055) / 1.055, 2.4);

    // חישוב הבהירות המשוקללת
    const luminance = 0.2126 * R + 0.7152 * G + 0.0722 * B;

    // ערך הסף לפי WCAG לניגודיות טובה
    const LUMINANCE_THRESHOLD = 0.5;

    // החזרת קלאס צבע הטקסט המתאים
    return luminance >= LUMINANCE_THRESHOLD ? 'text-gray-900' : 'text-white';
  }

  /**
 * בדיקה אם השינוי במפ"ל הוא חיובי
 */
  isMfplChangePositive(conversation: ConversationListItem): boolean {
    const change = this.getMfplScore(conversation).change;
    return change !== null && change > 0;
  }

  /**
   * בדיקה אם השינוי במפ"ל הוא שלילי
   */
  isMfplChangeNegative(conversation: ConversationListItem): boolean {
    const change = this.getMfplScore(conversation).change;
    return change !== null && change < 0;
  }

  /**
   * טעינת רשימת השיחות מהשרת
   */
  loadConversations(): void {
    this.isLoading = true;

    this.advisorService.getConversations().pipe(
      finalize(() => this.isLoading = false)
    ).subscribe({
      next: (conversations: ConversationListItem[]) => {
        this.conversations = conversations;
        this.applyFilters(); // החל סינון וחיפוש
      },
      error: (err) => {
        console.error('Error loading conversations:', err);
        // ניתן להוסיף כאן הצגת הודעת שגיאה למשתמש
      }
    });
  }

  /**
   * החלת פילטרים וחיפוש על רשימת השיחות
   */
  /**
 * החלת פילטרים וחיפוש על רשימת השיחות
 */
  applyFilters(): void {
    // סינון לפי מונח חיפוש (בכותרת, בתוכן כל ההודעות, או במידע המשתמש)
    this.filteredConversations = this.conversations.filter(conversation => {
      // אם אין מונח חיפוש, כלול את השיחה
      if (!this.searchTerm.trim()) {
        return true;
      }

      const term = this.searchTerm.toLowerCase();

      // חיפוש בכותרת
      const title = conversation.title?.toLowerCase() || '';
      if (title.includes(term)) {
        return true;
      }

      // חיפוש במידע המשתמש
      const userInfo = conversation.context?.userProfile
        ? JSON.stringify(conversation.context.userProfile).toLowerCase()
        : '';
      if (userInfo.includes(term)) {
        return true;
      }

      // בדיקה אם יש הודעות בשיחה
      if (!conversation.messages || conversation.messages.length === 0) {
        return false;
      }

      // חיפוש בכל ההודעות של השיחה
      return conversation.messages.some(message => {
        const messageText = message.text?.toLowerCase() || '';
        return messageText.includes(term);
      });
    });

    // מיון לפי תאריך עדכון
    this.filteredConversations.sort((a, b) => {
      const dateA = new Date(a.updatedAt || a.createdAt).getTime();
      const dateB = new Date(b.updatedAt || b.createdAt).getTime();
      return this.sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
    });
  }

  // פונקציה לבדיקה אם שיחה היא חדשה (נוצרה ב-24 השעות האחרונות)
  isNewConversation(conversation: any): boolean {
    if (!conversation.createdAt) return false;

    const created = new Date(conversation.createdAt);
    const now = new Date();
    const hoursSinceCreation = (now.getTime() - created.getTime()) / (1000 * 60 * 60);

    return hoursSinceCreation < 24;
  }

  // עדכון פונקציית הטעינה כדי לזכור את השיחה האחרונה שנצפתה
  loadConversation(conversationId: string): void {
    // שמירת מזהה השיחה שנטענה
    this.lastViewedConversation = conversationId;

    // המשך הפונקציה כפי שהייתה
    localStorage.setItem('currentConversationId', conversationId);
    this.router.navigate(['/conversation']);

    // אחרי 5 שניות, נקה את האפקט
    setTimeout(() => {
      this.lastViewedConversation = null;
    }, 5000);
  }

  startNewConversation(): void {
    // נקה את השיחה הנוכחית
    localStorage.removeItem('currentConversationId');

    // נווט לעמוד השיחה
    this.router.navigate(['/conversation']);
  }

  /**
   * שינוי סדר המיון
   */
  toggleSort(): void {
    this.sortOrder = this.sortOrder === 'desc' ? 'asc' : 'desc';
    this.applyFilters();
  }

  /**
   * מחיקת שיחה
   */
  deleteConversation(conversationId: string): void {
    if (this.deleteConfirmationId === conversationId) {
      // מצב אישור - בצע מחיקה
      this.isDeleting = true;

      this.advisorService.deleteConversation(conversationId).pipe(
        finalize(() => {
          this.isDeleting = false;
          this.deleteConfirmationId = null;
        })
      ).subscribe({
        next: (success) => {
          if (success) {
            // הסר את השיחה מהרשימה המקומית
            this.conversations = this.conversations.filter(c => c._id !== conversationId);
            this.applyFilters();

            // אם המשתמש מחק את השיחה הנוכחית שפתוחה, מחק את המזהה מהאחסון המקומי
            const currentConversationId = localStorage.getItem('currentConversationId');
            if (currentConversationId === conversationId) {
              localStorage.removeItem('currentConversationId');
            }
          } else {
            console.error('Server returned false success status for deletion');
            // ניתן להוסיף כאן הצגת הודעת שגיאה למשתמש
          }
        },
        error: (err) => {
          console.error('Error deleting conversation:', err);
          // ניתן להוסיף כאן הצגת הודעת שגיאה למשתמש
        }
      });
    } else {
      // מצב ראשוני - בקש אישור
      this.deleteConfirmationId = conversationId;
    }
  }

  /**
   * ביטול אישור מחיקה
   */
  cancelDelete(): void {
    this.deleteConfirmationId = null;
  }

  /**
   * פורמט תאריך לתצוגה ידידותית
   */
  formatDate(dateString: string): string {
    if (!dateString) return 'תאריך לא ידוע';

    const date = new Date(dateString);
    return date.toLocaleString('he-IL', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  /**
   * קבלת ההודעה האחרונה בשיחה
   */
  /**
 * קבלת ההודעה האחרונה בשיחה
 */
  getLastMessage(conversation: ConversationListItem): { text: string, date: string } {
    // בדיקה אם יש הודעות בכלל
    if (!conversation.messages || conversation.messages.length === 0) {
      return {
        text: 'אין הודעות בשיחה זו',
        date: conversation.createdAt?.toString() || ''
      };
    }

    // אם יש הודעות, מחפשים את ההודעה האחרונה של המערכת (יועץ)
    let lastSystemMessage = null;
    for (let i = conversation.messages.length - 1; i >= 0; i--) {
      if (conversation.messages[i].sender === 'system') {
        lastSystemMessage = conversation.messages[i];
        break;
      }
    }

    // אם לא נמצאה הודעת מערכת, מחזירים את ההודעה האחרונה בכלל
    const messageToDisplay = lastSystemMessage || conversation.messages[conversation.messages.length - 1];

    // מנקה HTML טאגים אם יש
    const plainText = messageToDisplay.text.replace(/<[^>]*>/g, '');

    // מקצרים את הטקסט אם הוא ארוך מדי
    const shortText = plainText.length <= 60 ? plainText : plainText.substring(0, 60) + '...';

    // הוספת יועץ לטקסט אם קיים
    const advisorPrefix = messageToDisplay.advisorId ?
      `[${this.getAdvisorName(messageToDisplay.advisorId)}]: ` : '';

    return {
      text: advisorPrefix + shortText,
      date: messageToDisplay.timestamp?.toString() || conversation.updatedAt?.toString() || conversation.createdAt?.toString() || ''
    };
  }

  // פונקציית עזר להשגת שם היועץ
  getAdvisorName(advisorId: string): string {
    const advisorNames: Record<string, string> = {
      'strategy': 'אופק',
      'budget': 'רון',
      'mortgage': 'גיא',
      'investments': 'דנה',
      'pension': 'יעל',
      'risk': 'ענת',
      'behavior': 'ליאור',
      'selfemployed': 'עידו',
      'special': 'אלינור',
      'data': 'תום',
      'career': 'נועם',
      'meaning': 'אמיר',
      'abundance': 'הדס',
      'young': 'טל',
      'altinvest': 'יואב',
      'intergen': 'מיכל',
      'altretire': 'נועה'
    };
    return advisorNames[advisorId] || 'יועץ';
  }

  getAllParticipatingAdvisors(conversation: ConversationListItem): string[] {
    // מיפוי שמות היועצים
    const advisorNames: Record<string, string> = {
      'strategy': 'אופק',
      'budget': 'רון',
      'mortgage': 'גיא',
      'investments': 'דנה',
      'pension': 'יעל',
      'risk': 'ענת',
      'behavior': 'ליאור',
      'selfemployed': 'עידו',
      'special': 'אלינור',
      'data': 'תום',
      'career': 'נועם',
      'meaning': 'אמיר',
      'abundance': 'הדס',
      'young': 'טל',
      'altinvest': 'יואב',
      'intergen': 'מיכל',
      'altretire': 'נועה'
    };

    // בדיקה אם יש הודעות בכלל
    if (!conversation.messages || conversation.messages.length === 0) {
      return [];
    }

    // מציאת כל מזהי היועצים הייחודיים
    const uniqueAdvisorIds = new Set<string>();

    // סריקת כל ההודעות
    for (const msg of conversation.messages) {
      console.log('[MESSAGE]', msg.sender, msg.advisorId, msg.text?.slice(0, 50));
      if (msg.sender === 'system' && msg.advisorId && advisorNames[msg.advisorId]) {
        uniqueAdvisorIds.add(msg.advisorId);
      }
    }

    // המרת מזהים לשמות
    return Array.from(uniqueAdvisorIds)
      .map(id => advisorNames[id] || '')
      .filter(name => name !== '');
  }

  /**
 * קבלת צבע היועץ לתגית
 */
  getAdvisorTagColor(advisorId: string): string {
    const colorMapping: Record<string, string> = {
      'strategy': 'bg-cyan-700',
      'budget': 'bg-amber-700',
      'mortgage': 'bg-blue-600',
      'investments': 'bg-green-600',
      'pension': 'bg-purple-600',
      'risk': 'bg-pink-600',
      'behavior': 'bg-rose-600',
      'selfemployed': 'bg-yellow-600',
      'special': 'bg-orange-600',
      'data': 'bg-slate-600',
      'career': 'bg-emerald-600',
      'meaning': 'bg-yellow-700',
      'abundance': 'bg-fuchsia-600',
      'young': 'bg-cyan-600',
      'altinvest': 'bg-lime-600',
      'intergen': 'bg-teal-700',
      'altretire': 'bg-red-600'
    };

    return colorMapping[advisorId] || 'bg-gray-700';
  }



  /**
   * קבלת מידע על ציון ה-MFPL של השיחה
   */
  getMfplScore(conversation: ConversationListItem): { current: number | null, change: number | null } {
    // בדיקות נוספות למקרה שהשדות חסרים
    if (!conversation.mfplScores) {
      return { current: null, change: null };
    }

    const initialScore = conversation.mfplScores?.initial?.overall ?? null;
    const currentScore = conversation.mfplScores?.current?.overall ?? null;

    if (currentScore === null) {
      return { current: null, change: null };
    }

    const change = initialScore !== null ? currentScore - initialScore : null;

    return { current: currentScore, change };
  }

  /**
   * האם השיחה במצב מיוחד
   */
  isSpecialMode(conversation: ConversationListItem): boolean {
    return conversation.state?.conversationPhase === 'future-self' ||
      conversation.state?.specialMode === 'future-self';
  }

  /**
  * קבלת שם של היועץ הנוכחי בשיחה - עם טיפול במקרים חריגים
  */
  getCurrentAdvisorName(conversation: ConversationListItem): string {
    const advisorId = conversation.state?.currentAdvisor;

    // אם אין מזהה יועץ, נחזיר ערך ברירת מחדל
    if (!advisorId) {
      return 'יועץ';
    }

    // מיפוי שמות היועצים
    const advisorNames: Record<string, string> = {
      'strategy': 'אופק – מנהל יועצים פיננסיים',
      'budget': 'רון – כלכלת המשפחה',
      'mortgage': 'גיא – משכנתאות ונדל"ן',
      'investments': 'דנה – השקעות וחסכונות',
      'pension': 'יעל - פרישה ופנסיה',
      'risk': 'ענת – ביטוחים והגנות',
      'behavior': 'ליאור – כלכלה התנהגותית',
      'selfemployed': 'עידו – עצמאים ועסקים קטנים',
      'special': 'אלינור – מצבים מיוחדים',
      'data': 'תום – ניתוח נתונים פיננסיים',
      'career': 'נועם – קריירה וצמיחה פיננסית',
      'meaning': 'אמיר – איכות חיים ושפע',
      'abundance': 'הדס – תודעת שפע',
      'young': 'טל – צעירים ודור Z',
      'altinvest': 'יואב – השקעות אלטרנטיביות',
      'intergen': 'מיכל – העברה בין-דורית',
      'altretire': 'נועה - פרישה אלטרנטיבית',
    };

    // בדיקה אם היועץ קיים במיפוי
    if (advisorNames[advisorId]) {
      return advisorNames[advisorId];
    }

    // אם היועץ לא קיים במיפוי, ננסה להסתכל על ההודעות
    if (conversation.messages && conversation.messages.length > 0) {
      // חיפוש אחר ההודעה האחרונה מהמערכת עם מזהה יועץ
      for (let i = conversation.messages.length - 1; i >= 0; i--) {
        const msg = conversation.messages[i];
        if (msg.sender === 'system' && msg.advisorId && advisorNames[msg.advisorId]) {
          return advisorNames[msg.advisorId];
        }
      }
    }

    // אם לא נמצא יועץ מוכר, נחזיר ערך ברירת מחדל
    return 'יועץ';
  }

  getLastActiveAdvisor(conversation: ConversationListItem): string {
    // מיפוי שמות היועצים
    const advisorNames: Record<string, string> = {
      'strategy': 'אופק – מנהל יועצים פיננסיים',
      'budget': 'רון – כלכלת המשפחה',
      'mortgage': 'גיא – משכנתאות ונדל"ן',
      'investments': 'דנה – השקעות וחסכונות',
      'pension': 'יעל - פרישה ופנסיה',
      'risk': 'ענת – ביטוחים והגנות',
      'behavior': 'ליאור – כלכלה התנהגותית',
      'selfemployed': 'עידו – עצמאים ועסקים קטנים',
      'special': 'אלינור – מצבים מיוחדים',
      'data': 'תום – ניתוח נתונים פיננסיים',
      'career': 'נועם – קריירה וצמיחה פיננסית',
      'meaning': 'אמיר – איכות חיים ושפע',
      'abundance': 'הדס – תודעת שפע',
      'young': 'טל – צעירים ודור Z',
      'altinvest': 'יואב – השקעות אלטרנטיביות',
      'intergen': 'מיכל – העברה בין-דורית',
      'altretire': 'נועה - פרישה אלטרנטיבית',
    };

    // בדיקה אם יש הודעות בכלל
    if (!conversation.messages || conversation.messages.length === 0) {
      return 'יועץ';
    }

    // חיפוש ההודעה האחרונה מהמערכת עם מזהה יועץ מוכר
    for (let i = conversation.messages.length - 1; i >= 0; i--) {
      const msg = conversation.messages[i];
      if (msg.sender === 'system' && msg.advisorId && advisorNames[msg.advisorId]) {
        return advisorNames[msg.advisorId];
      }
    }

    // אם לא נמצא יועץ מוכר, ננסה להשתמש ב-state אם קיים
    if (conversation.state?.currentAdvisor && advisorNames[conversation.state.currentAdvisor]) {
      return advisorNames[conversation.state.currentAdvisor];
    }

    // אם עדיין לא נמצא יועץ, נחזיר ערך ברירת מחדל
    return 'יועץ';
  }


  /**
 * קבלת המזהה של היועץ האחרון בשיחה
 */
  getLastAdvisorId(conversation: ConversationListItem): string {
    if (!conversation.messages || conversation.messages.length === 0) {
      return '';
    }

    // חיפוש ההודעה האחרונה עם מזהה יועץ
    for (let i = conversation.messages.length - 1; i >= 0; i--) {
      const msg = conversation.messages[i];
      if (msg.advisorId) {
        return msg.advisorId;
      }
    }

    // אם לא נמצא, ננסה להשתמש בiועץ הנוכחי
    return conversation.state?.currentAdvisor || '';
  }

  /**
   * קבלת צבע טקסט לפי היועץ
   */
  getAdvisorTextColor(advisorId: string): string {
    const colorMapping: Record<string, string> = {
      'strategy': 'text-cyan-500',
      'budget': 'text-amber-500',
      'mortgage': 'text-blue-400',
      'investments': 'text-green-400',
      'pension': 'text-purple-400',
      'risk': 'text-pink-400',
      'behavior': 'text-rose-400',
      'selfemployed': 'text-yellow-400',
      'special': 'text-orange-400',
      'data': 'text-slate-400',
      'career': 'text-emerald-400',
      'meaning': 'text-yellow-500',
      'abundance': 'text-fuchsia-400',
      'young': 'text-cyan-400',
      'altinvest': 'text-lime-400',
      'intergen': 'text-teal-500',
      'altretire': 'text-red-400'
    };

    return colorMapping[advisorId] || 'text-white';
  }

  /**
   * קבלת צבע גבול לפי היועץ
   */
  getAdvisorBorderColor(advisorId: string): string {
    const colorMapping: Record<string, string> = {
      'strategy': 'border-cyan-700',
      'budget': 'border-amber-700',
      'mortgage': 'border-blue-600',
      'investments': 'border-green-600',
      'pension': 'border-purple-600',
      'risk': 'border-pink-600',
      'behavior': 'border-rose-600',
      'selfemployed': 'border-yellow-600',
      'special': 'border-orange-600',
      'data': 'border-slate-600',
      'career': 'border-emerald-600',
      'meaning': 'border-yellow-700',
      'abundance': 'border-fuchsia-600',
      'young': 'border-cyan-600',
      'altinvest': 'border-lime-600',
      'intergen': 'border-teal-700',
      'altretire': 'border-red-600'
    };

    return colorMapping[advisorId] || 'border-gray-600';
  }

  /**
   * קבלת צבע רקע לפי היועץ לנקודה קטנה
   */
  getAdvisorBgColor(advisorId: string): string {
    const colorMapping: Record<string, string> = {
      'strategy': 'bg-cyan-500',
      'budget': 'bg-amber-500',
      'mortgage': 'bg-blue-400',
      'investments': 'bg-green-400',
      'pension': 'bg-purple-400',
      'risk': 'bg-pink-400',
      'behavior': 'bg-rose-400',
      'selfemployed': 'bg-yellow-400',
      'special': 'bg-orange-400',
      'data': 'bg-slate-400',
      'career': 'bg-emerald-400',
      'meaning': 'bg-yellow-500',
      'abundance': 'bg-fuchsia-400',
      'young': 'bg-cyan-400',
      'altinvest': 'bg-lime-400',
      'intergen': 'bg-teal-500',
      'altretire': 'bg-red-400'
    };

    return colorMapping[advisorId] || 'bg-gray-400';
  }

  /**
   * קבלת השם הקצר של היועץ (רק שם פרטי)
   */
  getShortAdvisorName(fullName: string): string {
    return fullName.split(' –')[0] || fullName;
  }

  /**
 * מציאת כל היועצים הייחודיים שהשתתפו בשיחה עם המזהים שלהם
 */
  /**
   * מציאת כל היועצים הייחודיים שהשתתפו בשיחה עם המזהים שלהם
   */
  /**
   * מציאת כל היועצים הייחודיים שהשתתפו בשיחה עם המזהים שלהם
   */
  getAllParticipatingAdvisorsWithIds(conversation: ConversationListItem): Array<{ id: string, name: string }> {
    // מיפוי שמות היועצים המלאים
    const advisorNames: Record<string, string> = {
      'strategy': 'אופק – מנהל יועצים פיננסיים',
      'budget': 'רון – כלכלת המשפחה',
      'mortgage': 'גיא – משכנתאות ונדל"ן',
      'investments': 'דנה – השקעות וחסכונות',
      'pension': 'יעל - פרישה ופנסיה',
      'risk': 'ענת – ביטוחים והגנות',
      'behavior': 'ליאור – כלכלה התנהגותית',
      'selfemployed': 'עידו – עצמאים ועסקים קטנים',
      'special': 'אלינור – מצבים מיוחדים',
      'data': 'תום – ניתוח נתונים פיננסיים',
      'career': 'נועם – קריירה וצמיחה פיננסית',
      'meaning': 'אמיר – איכות חיים ושפע',
      'abundance': 'הדס – תודעת שפע',
      'young': 'טל – צעירים ודור Z',
      'altinvest': 'יואב – השקעות אלטרנטיביות',
      'intergen': 'מיכל – העברה בין-דורית',
      'altretire': 'נועה - פרישה אלטרנטיבית'
    };

    // בדיקה אם יש הודעות בכלל
    if (!conversation.messages || conversation.messages.length === 0) {
      return [];
    }

    // מציאת כל מזהי היועצים הייחודיים
    const uniqueAdvisorIds = new Set<string>();

    // הוספה מכל המקורות האפשריים

    // מהודעות - כולל כל ההודעות, לא רק מסוג system
    for (const msg of conversation.messages) {
      if (msg.advisorId && advisorNames[msg.advisorId]) {
        uniqueAdvisorIds.add(msg.advisorId);
      }
    }

    // מהמצב הנוכחי
    if (conversation.state?.currentAdvisor && advisorNames[conversation.state.currentAdvisor]) {
      uniqueAdvisorIds.add(conversation.state.currentAdvisor);
    }

    // מיועצים קודמים במצב השיחה - אם השדה קיים
    if (conversation.state?.previousAdvisors && Array.isArray(conversation.state.previousAdvisors)) {
      for (const advisorId of conversation.state.previousAdvisors) {
        if (advisorNames[advisorId]) {
          uniqueAdvisorIds.add(advisorId);
        }
      }
    }

    // חיפוש בטקסט - אולי יש אזכורים של יועצים בטקסט
    /* for (const msg of conversation.messages) {
      if (msg.text) {
        for (const [id, name] of Object.entries(advisorNames)) {
          // חיפוש שם היועץ בטקסט (חיפוש השם הפרטי בלבד, לפני הקו המפריד)
          const shortName = name.split(' –')[0];
          if (shortName && msg.text.includes(shortName)) {
            uniqueAdvisorIds.add(id);
          }
        }
      }
    } */

    // המרת מזהים לאובייקטים עם שם ומזהה
    return Array.from(uniqueAdvisorIds)
      .map(id => ({ id, name: advisorNames[id] || '' }))
      .filter(item => item.name !== '');
  }


  getAdvisorBackgroundColor(conversation: ConversationListItem): string {
    // בדיקה אם יש הודעות בכלל
    if (!conversation.messages || conversation.messages.length === 0) {
      return 'bg-gray-800';
    }

    // מיפוי צבעים של היועצים
    const colorMapping: Record<string, string> = {
      'strategy': 'bg-cyan-700',
      'budget': 'bg-amber-700',
      'mortgage': 'bg-blue-600',
      'investments': 'bg-green-600',
      'pension': 'bg-purple-600',
      'risk': 'bg-pink-600',
      'behavior': 'bg-rose-600',
      'selfemployed': 'bg-yellow-600',
      'special': 'bg-orange-600',
      'data': 'bg-slate-600',
      'career': 'bg-emerald-600',
      'meaning': 'bg-yellow-700',
      'abundance': 'bg-fuchsia-600',
      'young': 'bg-cyan-600',
      'altinvest': 'bg-lime-600',
      'intergen': 'bg-teal-700',
      'altretire': 'bg-red-600'
    };

    // חיפוש ההודעה האחרונה מהמערכת עם מזהה יועץ מוכר
    for (let i = conversation.messages.length - 1; i >= 0; i--) {
      const msg = conversation.messages[i];
      if (msg.sender === 'system' && msg.advisorId && colorMapping[msg.advisorId]) {
        return colorMapping[msg.advisorId];
      }
    }

    // אם לא נמצא יועץ מוכר בהודעות, ננסה להשתמש ב-state אם קיים
    if (conversation.state?.currentAdvisor && colorMapping[conversation.state.currentAdvisor]) {
      return colorMapping[conversation.state.currentAdvisor];
    }

    // ברירת מחדל אם לא נמצא יועץ מוכר
    return 'bg-gray-800';
  }

  /**
   * טקסט HTML מנוקה משגיאות
   */
  sanitize(text: string): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(text);
  }

  /**
   * התחלת עריכת כותרת
   */
  startTitleEdit(conversationId: string, currentTitle: string): void {
    // ביטול כל עריכות אחרות
    this.editTitleId = null;
    this.cancelDelete();

    // התחלת עריכה חדשה
    this.editTitleId = conversationId;
    this.newTitle = currentTitle;
  }

  /**
   * ביטול עריכת כותרת
   */
  cancelTitleEdit(): void {
    this.editTitleId = null;
    this.newTitle = '';
  }

  /**
   * שמירת כותרת חדשה
   */
  saveNewTitle(conversationId: string): void {
    if (!this.newTitle.trim()) {
      return; // אין לשמור כותרת ריקה
    }

    this.isUpdatingTitle = true;

    this.advisorService.updateConversationTitle(conversationId, this.newTitle).pipe(
      finalize(() => {
        this.isUpdatingTitle = false;
      })
    ).subscribe({
      next: (success) => {
        if (success) {
          // עדכון הכותרת ברשימה המקומית
          const conversation = this.conversations.find(c => c._id === conversationId);
          if (conversation) {
            conversation.title = this.newTitle;
            this.applyFilters(); // עדכון הרשימה המסוננת
          }

          // איפוס המצב עריכה
          this.editTitleId = null;
          this.newTitle = '';
        } else {
          console.error('Server returned false success status for title update');
          // אפשר להוסיף הודעת שגיאה למשתמש
        }
      },
      error: (err) => {
        console.error('Error updating conversation title:', err);
        // אפשר להוסיף הודעת שגיאה למשתמש
      }
    });
  }

  getConversationTitle(conversation: ConversationListItem): string {
    // אם כבר יש כותרת שמישהו הגדיר ידנית, השתמש בה
    if (conversation.title && conversation.title !== 'שיחה חדשה') {
      return conversation.title;
    }

    // אם יש מידע על פרופיל המשתמש, השתמש בו ליצירת כותרת עם הקשר
    if (conversation.context?.userProfile?.name) {
      const name = conversation.context.userProfile.name;

      // אם יש מידע על מטרות, כלול אותן בכותרת
      if (conversation.context?.goals && conversation.context.goals.length > 0) {
        const goal = conversation.context.goals[0];
        return `שיחה עם ${name} על ${goal.description || 'תכנון פיננסי'}`;
      }

      // אם יש מידע על תחומי עניין, כלול אותם בכותרת
      if (conversation.state?.currentAdvisor) {
        const topic = this.getAdvisorTopic(conversation.state.currentAdvisor);
        return `שיחה עם ${name} בנושא ${topic}`;
      }

      return `ייעוץ פיננסי ל${name}`;
    }

    // אם אין מידע על המשתמש אבל יש הודעות, נסה לחלץ נושא משמעותי
    if (conversation.messages && conversation.messages.length > 0) {
      // נתח את 3 ההודעות הראשונות לזיהוי נושא
      const firstMessages = conversation.messages.slice(0, 3);
      const messageText = firstMessages.map(msg => msg.text).join(' ');

      // מילות מפתח פיננסיות לחיפוש
      const financialKeywords = [
        'תקציב', 'חיסכון', 'השקעות', 'משכנתא', 'הלוואה', 'פנסיה', 'ביטוח',
        'נדל"ן', 'מס', 'הכנסות', 'הוצאות', 'חובות', 'עצמאי', 'שכיר'
      ];

      // בדוק אם מילות המפתח מופיעות בטקסט
      for (const keyword of financialKeywords) {
        if (messageText.includes(keyword)) {
          return `ייעוץ בנושא ${keyword}`;
        }
      }

      // אם לא נמצאו מילות מפתח, השתמש בתחילת ההודעה הראשונה
      const plainText = firstMessages[0].text.replace(/<[^>]*>/g, '');
      const shortTitle = plainText.length <= 30 ? plainText : plainText.substring(0, 30) + '...';

      return shortTitle;
    }

    // אם אין מספיק מידע, השתמש בתאריך
    const date = new Date(conversation.createdAt);
    const dateString = date.toLocaleDateString('he-IL', {
      day: 'numeric',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit'
    });

    return `שיחת ייעוץ מתאריך ${dateString}`;
  }

  // פונקציית עזר להמרת מזהה יועץ לתחום שלו
  private getAdvisorTopic(advisorId: string): string {
    const topics: Record<string, string> = {
      'strategy': 'אסטרטגיה פיננסית',
      'budget': 'תקציב משפחתי',
      'mortgage': 'משכנתאות ונדל"ן',
      'investments': 'השקעות',
      'pension': 'פרישה ופנסיה',
      'risk': 'ביטוחים והגנות',
      'behavior': 'כלכלה התנהגותית',
      'selfemployed': 'עצמאים',
      'special': 'מצבים פיננסיים מיוחדים',
      'data': 'ניתוח נתונים פיננסיים',
      'career': 'קריירה וצמיחה כלכלית',
      'meaning': 'איכות חיים כלכלית',
      'abundance': 'תודעת שפע',
      'young': 'כלכלה לצעירים',
      'altinvest': 'השקעות אלטרנטיביות',
      'intergen': 'העברה בין-דורית',
      'altretire': 'פרישה אלטרנטיבית'
    };

    return topics[advisorId] || 'ייעוץ פיננסי';
  }



}