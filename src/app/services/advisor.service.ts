import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../environments/environment';
import { ChatMessage, AdvisorId } from '../models/chat-message.model';

// ממשק עבור היועץ
interface Advisor {
  name: string;
  icon: string;
  color: string;
  description?: string;
  role?: string;
}

// ממשק עבור תשובת השרת
interface AdvisorsResponse {
  success: boolean;
  advisors: Record<string, Advisor>;
}

// ממשק עבור תשובת השרת המלאה
interface CreateConversationResponse {
  success: boolean;
  conversation: {
    _id: string;
    userId: string;
    title: string;
    context: {
      userProfile: any;
      financialInfo: any;
      goals: string[];
      concerns: string[];
      triggers: {
        advisorTriggers: any;
      };
    };
    state: {
      currentAdvisor: string;
      previousAdvisors: string[];
      pendingAdvisors: string[];
      conversationPhase: string;
    };
    
    // שדות נוספים כמו timestamps וכו'
  };
  init: {
    advisor: AdvisorId,
    messages:  Array<{ role: string; content: string }>;
    stage: string,
    userIntroMessage: string
  }
}

export interface ConversationResponse {
    success: boolean;
    response: ChatMessage;
    conversation?: ChatMessage[];  // הוספנו אפשרות למערך הודעות מלא
    error?: string;
}

export interface ConversationHistoryResponse {
    success: boolean;
    conversation: {
      id: string;
      title: string;
      messages: ChatMessage[];
      startedAt: string;
      lastActivity: string;
      mfplScores?: any;
      state?: any;
    };
}

// ממשק לתיאור שיחה ברשימת השיחות
export interface ConversationListItem {
  _id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
  context?: {
    userProfile?: any;
    goals?: any[];
    concerns?: string[];
  };
  mfplScores?: {
    initial?: { overall?: number };
    current?: { overall?: number };
  };
  state?: {
    currentAdvisor?: string;
    conversationPhase?: string;
    specialMode?: string;
    previousAdvisors?: string[]; // הוספת הטיפוס המתאים
    userAge?: string;
  };
}

  
@Injectable({
  providedIn: 'root'
})
export class AdvisorService {
  private apiUrl = environment.apiBaseUrl;

  constructor(private http: HttpClient) {}

  deleteMessageFromConversation(conversationId: string, messageId: string) {
    return this.http.delete(`${this.apiUrl}/api/conversations/${conversationId}/message/${messageId}`);
  }


  /**
   * שליחת הודעה לרשת היועצים
   * @param message הודעת המשתמש
   * @param conversationId מזהה השיחה (אופציונלי, לשיחה מתמשכת)
   */
  sendMessage(message: string, conversationId?: string,advisorId?: AdvisorId): Observable<ConversationResponse> {
    const payload = {
      message,
      conversationId,
      userId: this.getUserId(), // פונקציית עזר לקבלת מזהה המשתמש
      advisorId
    };

    console.log('Sending message with advisorId:', advisorId);
    return this.http.post<ConversationResponse>(`${this.apiUrl}/api/conversations`, payload)
      .pipe(
        catchError(error => {
          console.error('Error sending message:', error);
          return throwError(() => new Error('שגיאה בתקשורת עם השרת. נסה שוב מאוחר יותר.'));
        })
      );
  }

  sendEditedMessage(
    message: string, 
    conversationId?: string, 
    originalMessageId?: string,
    systemResponseId?: string,
    advisorId?: AdvisorId
  ): Observable<any> {
    const url = `${this.apiUrl}/messages/edit`;
    
    const payload = {
      message,
      conversationId,
      originalMessageId, // מזהה ההודעה המקורית שצריך למחוק
      systemResponseId,  // מזהה תשובת המערכת שצריך למחוק (אם יש)
      advisorId
    };
  
    return this.http.post<any>(url, payload).pipe(
      catchError(this.handleError)
    );
  }
  
  /**
   * טיפול בשגיאות HTTP
   */
  private handleError(error: HttpErrorResponse) {
    let errorMessage = 'אירעה שגיאה לא ידועה';
    
    if (error.error instanceof ErrorEvent) {
      // שגיאת לקוח או רשת
      errorMessage = `שגיאה: ${error.error.message}`;
    } else {
      // שגיאת שרת
      errorMessage = `קוד שגיאה ${error.status}, הודעה: ${error.message}`;
    }
    
    console.error(errorMessage);
    
    // החזרת Observable עם הודעת שגיאה למשתמש
    return throwError(() => new Error(errorMessage));
  }
  

  /**
   * קבלת היסטוריית שיחה
   * @param conversationId מזהה השיחה
   */
  getConversationHistory(conversationId: string): Observable<ConversationHistoryResponse> {
    return this.http.get<ConversationHistoryResponse>(
      `${this.apiUrl}/api/conversations/${conversationId}`
    ).pipe(
      catchError(error => {
        console.error('Error fetching conversation history:', error);
        return throwError(() => new Error('שגיאה בטעינת היסטוריית השיחה.'));
      })
    );
  }

  /**
   * יצירת שיחה חדשה
   */
  createNewConversation(): Observable<{ conversationId: string ;init: {
    advisor: AdvisorId;
    messages: Array<{ role: string; content: string }>;
    stage: string;userIntroMessage:string}}> {
    return this.http.post<CreateConversationResponse>(`${this.apiUrl}/api/conversations/create`, {
      userId: this.getUserId()
    }).pipe(
      map(response => {
        // המרת התשובה המלאה לפורמט שהקוד המשתמש בו מצפה לקבל
        if (response && response.success && response.conversation && response.conversation._id) {
          // לוג למטרות דיבוג (אופציונלי)
          console.log('Received conversation:', response.conversation);
          
          // החזרת האובייקט עם המבנה המצופה
          return { conversationId: response.conversation._id.toString() ,init: response.init};
        } else {
          // טיפול במקרה שחסרים נתונים בתשובה
          console.error('Invalid server response:', response);
          throw new Error('תשובת השרת חסרה את מזהה השיחה');
        }
      }),
      catchError(error => {
        console.error('Error creating new conversation:', error);
        return throwError(() => new Error('שגיאה ביצירת שיחה חדשה.'));
      })
    );
  }

  /**
   * קבלת מידע על היועצים הקיימים במערכת
   */
  getAdvisors(): Observable<Record<string, Advisor>> {
    return this.http.get<AdvisorsResponse>(`${this.apiUrl}/api/advisors`)
      .pipe(
        map(response => {
          console.log('Raw server response:', response);
          // וידוא שהתשובה כוללת את שדה 'success' והיא אכן true
          if (response.success && response.advisors) {
            return response.advisors;
          } else {
            throw new Error('תשובת השרת אינה תקינה');
          }
        }),
        catchError(error => {
          console.error('Error fetching advisors:', error);
          return throwError(() => new Error('שגיאה בטעינת מידע על היועצים.'));
        })
      );
  }

  /**
   * קבלת רשימת כל השיחות של המשתמש
   */
  getConversations(): Observable<ConversationListItem[]> {
    // קבל את מזהה המשתמש מהאחסון המקומי
    const userId = this.getUserId();
    
    return this.http.get<{ success: boolean, conversations: ConversationListItem[] }>(
      `${this.apiUrl}/api/conversations?userId=${userId}`
    ).pipe(
      map(response => {
        if (response.success && Array.isArray(response.conversations)) {
          return response.conversations;
        } else {
          throw new Error('תשובת השרת אינה תקינה');
        }
      }),
      catchError(error => {
        console.error('Error fetching conversations list:', error);
        return throwError(() => new Error('שגיאה בטעינת רשימת השיחות.'));
      })
    );
  }

  /**
   * מחיקת שיחה
   * @param conversationId מזהה השיחה למחיקה
   */
  deleteConversation(conversationId: string): Observable<boolean> {
    return this.http.delete<{ success: boolean }>(
      `${this.apiUrl}/api/conversations/${conversationId}`
    ).pipe(
      map(response => response.success),
      catchError(error => {
        console.error('Error deleting conversation:', error);
        return throwError(() => new Error('שגיאה במחיקת השיחה.'));
      })
    );
  }

  /**
   * עדכון כותרת של שיחה
   * @param conversationId מזהה השיחה
   * @param title כותרת חדשה
   */
  updateConversationTitle(conversationId: string, title: string): Observable<boolean> {
    return this.http.patch<{ success: boolean }>(
      `${this.apiUrl}/api/conversations/${conversationId}`,
      { title }
    ).pipe(
      map(response => response.success),
      catchError(error => {
        console.error('Error updating conversation title:', error);
        return throwError(() => new Error('שגיאה בעדכון כותרת השיחה.'));
      })
    );
  }

  /**
   * פונקציית עזר לקבלת מזהה המשתמש הנוכחי
   * במקרה שיש מערכת משתמשים, יש להחליף זאת בקוד אמיתי
   */
  private getUserId(): string {
    // לוגיקה לקבלת מזהה משתמש - יש להתאים למערכת המשתמשים שלך
    const storedUserId = localStorage.getItem('userId');
    
    if (storedUserId) {
      return storedUserId;
    } else {
      // אם אין משתמש מחובר, נשתמש במזהה אנונימי קבוע 
      // או ניצור חדש ונשמור אותו
      const anonymousId = 'anonymous-' + Math.random().toString(36).substring(2, 15);
      localStorage.setItem('userId', anonymousId);
      return anonymousId;
    }
  }
}