import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MarkdownModule } from 'ngx-markdown';

@Component({
  selector: 'user-message',
  standalone: true,
  templateUrl: './user-message.component.html',
  styleUrls: ['./user-message.component.scss'],
  imports: [MarkdownModule,CommonModule, FormsModule]
})
export class UserMessageComponent {
  @Input() msg!: { text: string };
  @Input() isLastUserMessage: boolean = false;
  @Input() onEdit?: () => void;
  @Input() onDelete?: () => void;

  formatMarkdown(text: string): string {
    return text || '';
  }
}
