import { Component, Input } from '@angular/core';
import { ChatMessage } from '../../models/chat-message.model';
import { MarkdownModule } from 'ngx-markdown';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'advisor-message',
  standalone:true,
  templateUrl: './advisor-message.component.html',
  styleUrls: ['./advisor-message.component.scss'],
  imports: [MarkdownModule,CommonModule, FormsModule]
})
export class AdvisorMessageComponent {
  @Input() msg!: ChatMessage;
  @Input() advisor?: { name: string; icon: string; color: string };

  getAdvisorColorClass(): string {
    return this.advisor?.color || 'bg-gray-600';
  }

  getIconPath(icon: string | undefined): string {
    if (!icon) return 'assets/images/default-advisor.png'; // fallback image

    if (icon.startsWith('http')) {
      return icon;
    }

    if (icon.startsWith('/')) {
      const cleanPath = icon.substring(1);
      return `assets/images/${cleanPath}`;
    }

    return icon; // e.g., emoji
  }

  formatMarkdown(text: string): string {
    if (!text) return '';

    // Convert LaTeX delimiters: \[...\] to $$...$$ and \(...\) to $...$
    return text
      .replace(/\\\[/g, '$$')
      .replace(/\\\]/g, '$$')
      .replace(/\\\(/g, '$')
      .replace(/\\\)/g, '$');
  }

  getAdvisorName(): string {
    return this.advisor?.name || 'יועץ';
  }
}
