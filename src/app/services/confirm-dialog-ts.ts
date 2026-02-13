import { Component, Inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { CommonModule } from '@angular/common';

export interface ConfirmDialogData {
  title: string;
  message: string;
  confirmButtonText: string;
  cancelButtonText: string;
}

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule],
  template: `
    <div class="p-6 text-center" dir="rtl">
      <h2 class="text-xl font-bold mb-4">{{ data.title }}</h2>
      <p class="mb-6 text-gray-300">{{ data.message }}</p>
      <div class="flex justify-center gap-4">
        <button 
          class="px-6 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded-lg transition-colors"
          mat-button 
          (click)="onCancelClick()">
          {{ data.cancelButtonText }}
        </button>
        <button 
          class="px-6 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors"
          mat-button 
          color="warn" 
          (click)="onConfirmClick()">
          {{ data.confirmButtonText }}
        </button>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }
    
    .mat-mdc-dialog-container {
      border-radius: 1rem;
      overflow: hidden;
    }
  `]
})
export class ConfirmDialogComponent {
  constructor(
    public dialogRef: MatDialogRef<ConfirmDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: ConfirmDialogData
  ) {}

  /**
   * טיפול בלחיצה על כפתור האישור
   */
  onConfirmClick(): void {
    this.dialogRef.close(true);
  }

  /**
   * טיפול בלחיצה על כפתור הביטול
   */
  onCancelClick(): void {
    this.dialogRef.close(false);
  }
}
