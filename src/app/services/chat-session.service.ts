import { Injectable } from '@angular/core';
import { AdvisorId } from '../models/chat-message.model';

@Injectable({
  providedIn: 'root'
})
export class ChatSessionService {
  private advisorId = 'strategy' as AdvisorId; // התחלה קבועה, יתעדכן לפי התשובות מהשרת
  private history: any[] = [];

  getAdvisorId(): string {
    return this.advisorId;
  }

  setAdvisorId(id: AdvisorId): void {
    this.advisorId = id;
  }

  getHistory(): any[] {
    return this.history;
  }

  addToHistory(message: any): void {
    this.history.push(message);
  }

  resetSession(): void {
    this.advisorId = 'strategy' as AdvisorId;
    this.history = [];
  }
}
