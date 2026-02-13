import { Directive, ElementRef, Input, OnInit } from '@angular/core';

/**
 * דירקטיבה שמתאימה את רוחב ההודעה באופן דינמי לפי אורך התוכן
 * שימוש: <div [messageWidth]="message.text">...</div>
 */
@Directive({
  selector: '[messageWidth]',
  standalone: true
})
export class MessageWidthDirective implements OnInit {
  @Input('messageWidth') text: string = '';
  
  constructor(private el: ElementRef) {}
  
  ngOnInit() {
    // קביעת מחלקת רוחב בהתאם לאורך הטקסט
    if (this.text) {
      const textLength = this.text.length;
      
      // הסרת כל מחלקות רוחב קודמות
      this.el.nativeElement.classList.remove('short-message', 'medium-message', 'long-message');
      
      // הוספת מחלקה חדשה בהתאם לאורך
      if (textLength < 50) {
        this.el.nativeElement.classList.add('short-message');
      } else if (textLength < 200) {
        this.el.nativeElement.classList.add('medium-message');
      } else {
        this.el.nativeElement.classList.add('long-message');
      }
      
      // קביעת רוחב מינימלי בפיקסלים
      const minWidth = Math.max(100, Math.min(300, textLength * 0.8));
      this.el.nativeElement.style.minWidth = `${minWidth}px`;
    }
  }
}