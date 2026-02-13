import { Routes } from '@angular/router';
import { ConversationComponent } from './features/conversation/conversation.component';
import { ConversationListComponent } from './features/conversation-list/conversation-list.component';

export const routes: Routes = [
  { path: '', redirectTo: 'conversations', pathMatch: 'full' },
  { path: 'conversations', component: ConversationListComponent },
  { path: 'conversation', component: ConversationComponent },
  { path: '**', redirectTo: 'conversations' }
];

