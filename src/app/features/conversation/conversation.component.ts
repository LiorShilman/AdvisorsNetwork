import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, ElementRef, OnInit, Renderer2, SimpleChanges, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { finalize } from 'rxjs';
import { AdvisorService, ConversationHistoryResponse } from '../../services/advisor.service';
import { ChatMessage, AdvisorId } from '../../models/chat-message.model';
import { HttpClientModule } from '@angular/common/http';
import { ActivatedRoute, RouterModule } from '@angular/router'; // הוספת RouterModule
import { MessageWidthDirective } from '../../directives/dynamic-width-directive';
import { MarkdownModule } from 'ngx-markdown'; // הוספת ייבוא זה
import { ChatSessionService } from '../../services/chat-session.service';
import { UserMessageComponent } from '../user-message/user-message.component';
import { AdvisorMessageComponent } from "../advisor-message/advisor-message.component";

@Component({
  selector: 'app-conversation',
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule, RouterModule, MessageWidthDirective, MarkdownModule, UserMessageComponent, AdvisorMessageComponent], // הוספת RouterModule
  templateUrl: './conversation.component.html',
  styleUrls: ['./conversation.component.scss']
})

export class ConversationComponent implements OnInit, AfterViewInit {
  inputText: string = '';
  _isLoading: boolean = false;
  conversationId: string | null = null;
  forceAdvisorSwitch: boolean = false;
  lastAdvisorId: AdvisorId = 'strategy';
  lastNextAdvisorId: AdvisorId = 'strategy';
  editMode: boolean = false;
  editMessageText: string = '';
  lastUserMessageIndex: number = -1;
  expandedTextarea: boolean = false;
  responseSubscription: any = null; // או Subscription מ-RxJS
  showMobileAdvisors: boolean = false;
  advisorsList: { id: string; name: string; icon: string; color: string; description?: string }[] = [];

  // MAPAL 3.0 — ציוני מפ"ל ומסע היועצים
  mapalScore: Record<string, number> = {};

  readonly MAPAL_FIELDS: { key: string; label: string }[] = [
    { key: 'financialFoundations',        label: 'יסודות' },
    { key: 'behaviorAndHabits',           label: 'הרגלים' },
    { key: 'pensionPlanning',             label: 'פנסיה' },
    { key: 'assetDiversification',        label: 'השקעות' },
    { key: 'alternativeInvestments',      label: 'חדשנות' },
    { key: 'mortgageOptimization',        label: 'משכנתא' },
    { key: 'legalAndInsurance',           label: 'ביטוח' },
    { key: 'incomeGrowth',                label: 'הכנסה' },
    { key: 'specialSituationsResilience', label: 'מיוחד' },
    { key: 'dataBasedManagement',         label: 'נתונים' },
    { key: 'resourceLifeQualityBalance',  label: 'איזון' },
    { key: 'abundanceMindset',            label: 'שפע' },
    { key: 'intergenerationalTransfer',   label: 'ירושה' },
    { key: 'retirementAlternatives',      label: 'FIRE' }
  ];

  advisors: Record<AdvisorId, { name: string; icon: string; color: string; description?: string }> = {
    strategy: { name: 'אופק – מנהל יועצים פיננסיים', icon: '/strategy.png', color: 'bg-cyan-700' },
    budget: { name: 'רון – כלכלת המשפחה', icon: '/budget.png', color: 'bg-amber-700' },
    mortgage: { name: 'גיא – משכנתאות ונדל"ן', icon: '/mortgage.png', color: 'bg-blue-600' },
    investments: { name: 'דנה – השקעות וחסכונות', icon: '/investments.png', color: 'bg-green-600' },
    pension: { name: 'יעל – פרישה ופנסיה', icon: '/pension.png', color: 'bg-purple-600' },
    risk: { name: 'ענת – ביטוחים והגנות', icon: '/risk.png', color: 'bg-pink-600' },
    behavior: { name: 'ליאור – כלכלה התנהגותית', icon: '/behavior.png', color: 'bg-rose-600' },
    selfemployed: { name: 'עידו – עצמאים ועסקים קטנים', icon: '/selfemployed.png', color: 'bg-yellow-600' },
    special: { name: 'אלינור – מצבים מיוחדים', icon: '/special.png', color: 'bg-orange-600' },
    data: { name: 'תום – ניתוח נתונים פיננסיים', icon: '/data.png', color: 'bg-slate-600' },
    career: { name: 'נועם – קריירה וצמיחה פיננסית', icon: '/career.png', color: 'bg-emerald-600' },
    meaning: { name: 'אמיר – איכות חיים ושפע', icon: '/meaning.png', color: 'bg-yellow-700' },
    abundance: { name: 'הדס – תודעת שפע', icon: '/abundance.png', color: 'bg-fuchsia-600' },
    young: { name: 'טל – צעירים ודור Z', icon: '/young.png', color: 'bg-cyan-600' },
    altinvest: { name: 'יואב – השקעות אלטרנטיביות', icon: '/altinvest.png', color: 'bg-lime-600' },
    intergen: { name: 'מיכל – העברה בין-דורית', icon: '/intergen.png', color: 'bg-teal-700' },
    altretire: { name: 'נועה – פרישה אלטרנטיבית', icon: '/altretire.png', color: 'bg-red-600' },
    futureself: { name: 'העצמי העתידי', icon: '/futureself.png', color: 'bg-indigo-700' }
  };


  conversation: ChatMessage[] = [
    {
      text: `# 👨‍💼 אופק – מנהל יועצים פיננסיים

## ברוכים הבאים ל"אופק פיננסי 360°"

שלום! אני **אופק**, מנהל צוות היועצים הפיננסיים שלנו.

אשמח ללוות אותך בבניית תמונה פיננסית כוללת המותאמת לצרכים האישיים שלך. בעזרת צוות של 17 יועצים מומחים, נוכל לתכנן יחד את כל טווחי הזמן - מהתקציב החודשי השוטף, דרך החלטות קריירה ועד תכנון פרישה הוליסטי.

### לפני שנתחיל, אשמח להכיר אותך קצת:

1. **איך תרצה/י שאפנה אליך?** (שם)
2. **מה גילך כיום?**
3. **מה המצב המשפחתי שלך?** (רווק/ה, נשוי/אה, גרוש/ה, עם ילדים וכו')
4. **האם את/ה עובד/ת כשכיר/ה או עצמאי/ת?**

לאחר שנכיר, נוכל להתאים לך את הייעוץ הפיננסי הטוב ביותר, בהתאם לשלב החיים ולמטרות שלך. אני כאן כדי לכוון אותך ליועצים המתאימים בדיוק לצרכים שלך.`,
      sender: 'system',
      advisorId: 'strategy'
    }
  ];

  // ---- מסע יועצים ----
  get advisorJourney(): { id: AdvisorId; name: string; icon: string; color: string; count: number; isActive: boolean }[] {
    const visits: { id: AdvisorId; name: string; icon: string; color: string; count: number; isActive: boolean }[] = [];
    for (const msg of this.conversation) {
      if (msg.sender === 'system' && msg.advisorId && msg.text !== 'מקליד...') {
        const last = visits[visits.length - 1];
        if (last && last.id === msg.advisorId) {
          last.count++;
        } else {
          const a = this.advisors[msg.advisorId];
          if (a) visits.push({ id: msg.advisorId, name: a.name.split('–')[0].trim(), icon: a.icon, color: a.color, count: 1, isActive: false });
        }
      }
    }
    if (visits.length > 0) visits[visits.length - 1].isActive = true;
    return visits;
  }

  // ---- MAPAL Radar SVG ----
  getRadarPolygon(): string {
    const cx = 90, cy = 90, r = 72;
    const n = this.MAPAL_FIELDS.length;
    return this.MAPAL_FIELDS.map((f, i) => {
      const angle = (i * 2 * Math.PI / n) - Math.PI / 2;
      const val = Math.min((this.mapalScore[f.key] || 0) / 5, 1);
      return `${(cx + r * val * Math.cos(angle)).toFixed(1)},${(cy + r * val * Math.sin(angle)).toFixed(1)}`;
    }).join(' ');
  }

  getRadarAxes(): { x2: number; y2: number; label: string; labelX: number; labelY: number }[] {
    const cx = 90, cy = 90, r = 72, lr = 84;
    const n = this.MAPAL_FIELDS.length;
    return this.MAPAL_FIELDS.map((f, i) => {
      const angle = (i * 2 * Math.PI / n) - Math.PI / 2;
      return {
        x2: parseFloat((cx + r * Math.cos(angle)).toFixed(1)),
        y2: parseFloat((cy + r * Math.sin(angle)).toFixed(1)),
        label: f.label,
        labelX: parseFloat((cx + lr * Math.cos(angle)).toFixed(1)),
        labelY: parseFloat((cy + lr * Math.sin(angle)).toFixed(1))
      };
    });
  }

  getRadarPercent(): number {
    const total = this.MAPAL_FIELDS.reduce((s, f) => s + (this.mapalScore[f.key] || 0), 0);
    return Math.round((total / (this.MAPAL_FIELDS.length * 5)) * 100);
  }

  getRadarDotX(i: number): number {
    const cx = 90, r = 72, n = this.MAPAL_FIELDS.length;
    const angle = (i * 2 * Math.PI / n) - Math.PI / 2;
    const val = Math.min((this.mapalScore[this.MAPAL_FIELDS[i].key] || 0) / 5, 1);
    return parseFloat((cx + r * val * Math.cos(angle)).toFixed(1));
  }

  getRadarDotY(i: number): number {
    const cy = 90, r = 72, n = this.MAPAL_FIELDS.length;
    const angle = (i * 2 * Math.PI / n) - Math.PI / 2;
    const val = Math.min((this.mapalScore[this.MAPAL_FIELDS[i].key] || 0) / 5, 1);
    return parseFloat((cy + r * val * Math.sin(angle)).toFixed(1));
  }

  // ---- Journey 3 Columns ----
  getJourneyColumns() {
    const leftCol: typeof this.advisorJourney = [];
    const centerCol: typeof this.advisorJourney = [];
    const rightCol: typeof this.advisorJourney = [];

    let otherIndex = 0;
    this.advisorJourney.forEach(stop => {
      if (stop.id === 'strategy') {
        // אופק תמיד במרכז
        centerCol.push(stop);
      } else {
        // שאר היועצים מתחלקים לפי אינדקס זוגי/אי-זוגי
        if (otherIndex % 2 === 0) {
          rightCol.push(stop);  // RTL: ימין
        } else {
          leftCol.push(stop);   // RTL: שמאל
        }
        otherIndex++;
      }
    });

    return { leftCol, centerCol, rightCol };
  }

  constructor(
    private sanitizer: DomSanitizer,
    private advisorService: AdvisorService, private route: ActivatedRoute, private chatSession: ChatSessionService, private renderer: Renderer2
  ) { }

  @ViewChild('myInput') myInputRef!: ElementRef;

  focusWithRenderer() {
    setTimeout(() => {
      this.renderer.selectRootElement(this.myInputRef.nativeElement).focus();
    }, 0);
  }

  ngAfterViewInit() {

  }

  ngOnInit(): void {
    this.buildAdvisorsList(); // בניית רשימת יועצים מהנתונים המקומיים
    this.loadAdvisorsInfo(); // טען מידע מעודכן מהשרת

    this.route.queryParams.subscribe(params => {
      const isNewConversation = params['new'] === 'true';
      const savedConversationId = localStorage.getItem('currentConversationId');

      if (isNewConversation) {
        // התחלה יזומה של שיחה חדשה
        this.startNewConversation();
      } else if (savedConversationId) {
        // שיחה קיימת – טען היסטוריה
        this.conversationId = savedConversationId;
        this.loadConversationHistory();
      } else {
        // אין שיחה קיימת – צור חדשה
        this.createNewConversation();
      }

      // גלול אוטומטית לאחר טעינה
      setTimeout(() => {
        this.scrollToLastMessage();
      }, 100);
    });
  }


  /**
 * פונקציה המאפשרת גדילה דינמית של שדה הטקסט בהתאם לתוכן
 * @param element אלמנט ה-textarea
 */
  autoGrowTextareaHeight(element: HTMLTextAreaElement): void {
    // איפוס הגובה כדי למדוד את הגובה האמיתי הנדרש
    element.style.height = 'auto';

    // הגדרת הגובה החדש לפי תוכן הטקסט
    const minHeight = this.expandedTextarea ? 300 : 100;
    const newHeight = Math.max(minHeight, element.scrollHeight);

    // הגבלת הגובה המקסימלי על פי מצב ההרחבה
    const maxHeight = this.expandedTextarea ? 1000 : 200;
    const clampedHeight = Math.min(newHeight, maxHeight);

    // הגדרת הגובה החדש
    element.style.height = `${clampedHeight}px`;
  }

  /**
   * עצירת תשובת היועץ בתהליך
   */
  stopAdvisorResponse(): void {
    // בדיקה שאכן מתבצעת טעינה
    if (!this.isLoading) return;

    console.log('Stopping advisor response');

    // ביטול המנוי הנוכחי לתשובה (אם קיים)
    if (this.responseSubscription) {
      this.responseSubscription.unsubscribe();
      console.log('Unsubscribed from current response');
    }

    // סיום מצב הטעינה
    this.isLoading = false;

    // מחיקת הודעת "מקליד..." אם קיימת
    const lastMessageIndex = this.conversation.length - 1;
    if (lastMessageIndex >= 0 &&
      this.conversation[lastMessageIndex].sender === 'system' &&
      this.conversation[lastMessageIndex].text === 'מקליד...') {
      this.conversation.splice(lastMessageIndex, 1);
    }

    // הוספת הודעה שהתשובה נעצרה
    this.conversation.push({
      text: '**התשובה נעצרה על-ידי המשתמש**',
      sender: 'system',
      advisorId: this.lastAdvisorId
    });

    // גלילה להודעה החדשה
    setTimeout(() => {
      this.scrollToLastMessage();
    }, 100);
  }

  /**
   * מתג להרחבת/כיווץ שדה הטקסט
   */
  /**
   * בקשת מעבר ליועץ ספציפי - מעביר ישירות לפי advisorId
   */
  requestAdvisorSwitch(advisorId: string): void {
    if (this.isLoading || advisorId === this.lastAdvisorId) return;

    const advisor = this.advisors[advisorId as AdvisorId];
    if (!advisor) return;

    // קביעת היועץ המבוקש לפני שליחת ההודעה
    this.lastNextAdvisorId = advisorId as AdvisorId;

    const shortName = advisor.name.split('–')[0].trim().split('-')[0].trim();
    this.inputText = `אני רוצה לדבר עם ${shortName}`;
    this.sendMessage();
  }

  buildAdvisorsList(): void {
    this.advisorsList = Object.entries(this.advisors)
      .map(([id, advisor]) => ({ id, ...advisor }));
  }

  toggleTextareaExpand(): void {
    this.expandedTextarea = !this.expandedTextarea;

    // עדכון הגובה של שדה הטקסט בהתאם למצב החדש
    setTimeout(() => {
      const textArea = document.querySelector('textarea');
      if (textArea) {
        // מיקוד על שדה הטקסט
        textArea.focus();

        // עדכון גובה השדה
        this.autoGrowTextareaHeight(textArea as HTMLTextAreaElement);
      }
    }, 100);
  }

  /**
 * מבצע המרה/פורמט לטקסט ההודעה ל-Markdown
 */
  formatMessageMarkdown(text: string): string {
    // אם הטקסט כבר מכיל HTML, יש לטפל בו אחרת
    if (text.includes('<div') || text.includes('<p') || text.includes('<br')) {
      // נשאיר את ה-HTML כפי שהוא כי ngx-markdown תומכת גם ב-HTML מעורב עם markdown
      return text;
    }

    // במקרה של טקסט רגיל, נחזיר אותו כמו שהוא - 
    // ngx-markdown תדע להמיר אוטומטית שורות חדשות וכו' לפורמט מתאים
    return text;
  }

  handleKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      // אם SHIFT+ENTER - אפשר ירידת שורה
      if (event.shiftKey) {
        return; // המשך התנהגות רגילה - ירידת שורה
      }

      // אם ENTER בלבד - מנע התנהגות ברירת מחדל ושלח הודעה
      event.preventDefault();
      this.sendMessage();
    }
  }

  /**
* פורמט תאריך ושעה להודעה
*/
  formatMessageDate(date: Date | string | undefined): string {
    if (!date) return '';

    const messageDate = typeof date === 'string' ? new Date(date) : date;
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    // אם ההודעה מהיום - הצג רק את השעה
    if (messageDate >= today) {
      return messageDate.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
    }

    // אם ההודעה מאתמול
    if (messageDate >= yesterday) {
      return 'אתמול ' + messageDate.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
    }

    // אחרת, הצג תאריך מלא
    return messageDate.toLocaleDateString('he-IL', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  /**
 * התחלת מצב עריכה של ההודעה האחרונה של המשתמש
 */
  startEditLastMessage(): void {
    // מצא את האינדקס של ההודעה האחרונה של המשתמש
    for (let i = this.conversation.length - 1; i >= 0; i--) {
      if (this.conversation[i].sender === 'user') {
        this.lastUserMessageIndex = i;
        this.editMessageText = this.conversation[i].text;
        this.editMode = true;

        // מקם את הפוקוס בתיבת הטקסט
        setTimeout(() => {
          const textArea = document.querySelector('textarea');
          if (textArea) {
            this.inputText = this.editMessageText;
            textArea.focus();
          }
        }, 100);

        return;
      }
    }

    // אם אין הודעות משתמש
    console.log('לא נמצאו הודעות משתמש לעריכה');
  }

  /**
   * שמירת העריכה של ההודעה
   */
  saveEditedMessage(): void {
    if (this.lastUserMessageIndex >= 0 && this.lastUserMessageIndex < this.conversation.length) {
      // שמירת הטקסט המעודכן
      this.conversation[this.lastUserMessageIndex].text = this.inputText;

      // איפוס מצב העריכה
      this.editMode = false;
      this.inputText = '';
      this.lastUserMessageIndex = -1;

      // גלילה להודעה המעודכנת
      setTimeout(() => {
        this.scrollToLastMessage();
      }, 100);
    }
  }

  /**
   * ביטול מצב עריכה
   */
  cancelEdit(): void {
    this.editMode = false;
    this.inputText = '';
    this.lastUserMessageIndex = -1;
  }

  /**
   * מחיקת ההודעה האחרונה של המשתמש והתשובה שאחריה
   */
  deleteLastUserMessage(): void {
    for (let i = this.conversation.length - 1; i >= 0; i--) {
      if (this.conversation[i].sender === 'user') {
        this.lastUserMessageIndex = i;
        // בדוק אם יש תשובת מערכת אחרי הודעת המשתמש
        if (this.lastUserMessageIndex + 1 < this.conversation.length &&
          this.conversation[this.lastUserMessageIndex + 1].sender === 'system') {
          // מחק גם את תשובת המערכת
          this.conversation.splice(this.lastUserMessageIndex, 2);

          if (this.conversationId)
            this.advisorService.deleteMessageFromConversation(this.conversationId, this.lastUserMessageIndex.toString());

        } else {
          // מחק רק את הודעת המשתמש
          this.conversation.splice(this.lastUserMessageIndex, 1);
        }
        

        // איפוס מצב העריכה
        this.editMode = false;
        this.inputText = '';
        this.lastUserMessageIndex = -1;

        // גלילה לסוף השיחה המעודכנת
        setTimeout(() => {
          this.scrollToLastMessage();
        }, 100);

        return;
      }
    }
  }


  /**
  * שליחת ההודעה המעודכנת
  */
  sendEditedMessage(): void {
    if (this.lastUserMessageIndex >= 0) {
      // שמירת הטקסט המעודכן
      this.conversation[this.lastUserMessageIndex].text = this.inputText;

      // חיפוש מזהים להודעות שנרצה למחוק בשרת
      let originalMessageId: string | undefined = undefined;
      let systemResponseId: string | undefined = undefined;

      // בדיקה אם יש מזהה להודעת המשתמש המקורית
      const userMessage = this.conversation[this.lastUserMessageIndex];
      if (userMessage && userMessage._id) {
        originalMessageId = userMessage._id;
        console.log('Found original message ID:', originalMessageId);
      }

      // בדיקה אם יש תשובת מערכת ומזהה שלה
      if (this.lastUserMessageIndex + 1 < this.conversation.length &&
        this.conversation[this.lastUserMessageIndex + 1].sender === 'system') {

        const systemMessage = this.conversation[this.lastUserMessageIndex + 1];
        if (systemMessage && systemMessage._id) {
          systemResponseId = systemMessage._id;
          console.log('Found system response ID:', systemResponseId);
        }

        // מחיקת התשובה הקודמת מהתצוגה
        this.conversation.splice(this.lastUserMessageIndex + 1, 1);
      }

      // איפוס מצב העריכה
      this.editMode = false;
      const editedMessage = this.inputText;
      this.inputText = '';
      this.lastUserMessageIndex = -1;

      // סימון מצב טעינה
      this.isLoading = true;

      // אינדיקציה ויזואלית שהמערכת מקלידה תשובה
      const typingMessageIndex = this.conversation.push({
        text: 'מקליד...',
        sender: 'system',
        advisorId: this.lastAdvisorId
      }) - 1;


      // גלילה להודעה המעודכנת
      setTimeout(() => {
        this.scrollToLastMessage();
      }, 100);

      // בחירה בין sendEditedMessage לבין sendMessage הרגיל 
      // בהתאם לקיום מזהים להודעות למחיקה
      if (originalMessageId || systemResponseId) {
        // יש מזהים - נשתמש ב-sendEditedMessage
        console.log('Using sendEditedMessage with IDs');

        this.responseSubscription = this.advisorService.sendEditedMessage(
          editedMessage,
          this.conversationId || undefined,
          originalMessageId,
          systemResponseId,
          this.lastAdvisorId
        ).pipe(
          finalize(() => {
            this.isLoading = false;
            this.responseSubscription = null; // איפוס המנוי
            // הסרת הודעת ה"מקליד..." בכל מקרה
            if (typingMessageIndex >= 0) {
              this.conversation.splice(typingMessageIndex, 1);
            }
          })
        ).subscribe({
          next: (response: { success: any; response: ChatMessage; }) => {
            if (response.success && response.response) {
              // שמירת מזהה היועץ האחרון אם קיים
              if (response.response.advisorId) {
                this.lastAdvisorId = response.response.advisorId;
              }

              // הוספת תשובת היועץ לשיחה
              this.conversation.push(response.response);

              // גלילה להראות את התשובה החדשה
              setTimeout(() => {
                this.scrollToLastMessage();
              }, 100);
            } else {
              // טיפול בשגיאה...
              this.conversation.push({
                text: 'סליחה, אירעה שגיאה. נסה שוב מאוחר יותר.',
                sender: 'system',
                advisorId: 'strategy'
              });
              this.scrollToLastMessage();
            }
          },
          error: (err: any) => {
            console.error('Error in sendEditedMessage:', err);
            // טיפול בשגיאה...
            this.conversation.push({
              text: 'סליחה, נראה שיש בעיה בתקשורת עם השרת. נסה שוב מאוחר יותר.',
              sender: 'system',
              advisorId: 'strategy'
            });
            setTimeout(() => {
              this.scrollToLastMessage();
            }, 100);
          }
        });
      } else {
        // אין מזהים - נשתמש ב-sendMessage רגיל
        console.log('No message IDs found, using regular sendMessage');

        this.responseSubscription = this.advisorService.sendMessage(
          editedMessage,
          this.conversationId || undefined,
          this.lastAdvisorId
        ).pipe(
          finalize(() => {
            this.isLoading = false;
            // הסרת הודעת ה"מקליד..." בכל מקרה
            if (typingMessageIndex >= 0) {
              this.conversation.splice(typingMessageIndex, 1);
            }
          })
        ).subscribe({
          next: (response: { success: any; response: ChatMessage; }) => {
            if (response.success && response.response) {
              // שמירת מזהה היועץ האחרון אם קיים
              if (response.response.advisorId) {
                this.lastAdvisorId = response.response.advisorId;
              }

              // הוספת תשובת היועץ לשיחה
              this.conversation.push(response.response);

              // גלילה להראות את התשובה החדשה
              setTimeout(() => {
                this.scrollToLastMessage();
              }, 100);
            } else {
              // טיפול בשגיאה...
              this.conversation.push({
                text: 'סליחה, אירעה שגיאה. נסה שוב מאוחר יותר.',
                sender: 'system',
                advisorId: 'strategy'
              });
              this.scrollToLastMessage();
            }
          },
          error: (err: any) => {
            console.error('Error in sendMessage:', err);
            // טיפול בשגיאה...
            this.conversation.push({
              text: 'סליחה, נראה שיש בעיה בתקשורת עם השרת. נסה שוב מאוחר יותר.',
              sender: 'system',
              advisorId: 'strategy'
            });
            setTimeout(() => {
              this.scrollToLastMessage();
            }, 100);
          }
        });
      }
    }
  }
  /**
   * טעינת מידע מעודכן על היועצים מהשרת
   */
  loadAdvisorsInfo(): void {
    this.advisorService.getAdvisors().subscribe({
      next: (advisorsData: Record<AdvisorId, { name: string; icon: string; color: string; description?: string }>) => {
        // עדכון מידע על היועצים, אם יש שינויים בשרת
        this.advisors = { ...this.advisors, ...advisorsData };
        this.buildAdvisorsList();
      },
      error: (err: any) => {
        console.error('Error loading advisors info:', err);
        // אם יש שגיאה, נשתמש במידע המקומי שכבר קיים
      }
    });
  }


  /**
   * טעינת היסטוריית שיחה קיימת
   */
  /**
   * טעינת היסטוריית שיחה קיימת
   */
  loadConversationHistory(): void {
    if (!this.conversationId) return;

    this.isLoading = true;
    this.advisorService.getConversationHistory(this.conversationId).pipe(
      finalize(() => this.isLoading = false)
    ).subscribe({
      next: (response: ConversationHistoryResponse) => {
        // כעת הטיפוס מוגדר כראוי
        if (response.success && response.conversation && Array.isArray(response.conversation.messages) && response.conversation.messages.length > 0) {
          this.conversation = response.conversation.messages;

          // טעינת ציוני מפ"ל מה-state
          if (response.conversation.state?.mapalScore) {
            this.mapalScore = response.conversation.state.mapalScore;
          }

          // קוד חדש כאן - מציאת היועץ האחרון מההיסטוריה
          for (let i = this.conversation.length - 1; i >= 0; i--) {
            if (this.conversation[i].sender === 'system' && this.conversation[i].advisorId) {
              this.lastAdvisorId = this.conversation[i].advisorId as AdvisorId;
              console.log('Updated lastAdvisorId from history:', this.lastAdvisorId);
              break;
            }
          }

          setTimeout(() => {
            this.scrollToLastMessage();
          }, 2000);

        } else {
          console.error('Invalid response format or no messages found:', response);
          // יצירת שיחה חדשה במקרה של תשובה לא תקינה או אם לא נמצאו הודעות
          this.createNewConversation();
        }
      },
      error: (err) => {
        console.error('Error loading conversation history:', err);
        // יצירת שיחה חדשה במקרה של שגיאה
        this.createNewConversation();
      }
    });
  }

  createNewConversation(): void {
    this.advisorService.createNewConversation().subscribe({
      next: (data: {
        conversationId: string | null; init: {
          advisor: AdvisorId,
          messages: Array<{ role: string, content: string }>,
          stage: string, userIntroMessage: string
        }
      }) => {
        this.conversationId = data.conversationId;

        // שמירה ב-localStorage
        if (this.conversationId) {
          localStorage.setItem('currentConversationId', this.conversationId);
        }

        // הוספת הודעת הפתיחה תמיד, גם אם conversationId הוא null
        if (data.init?.userIntroMessage) {
          this.conversation = [
            {
              text: data.init.userIntroMessage,
              sender: 'system',
              advisorId: data.init.advisor
            }
          ];

          console.log('Welcome message added to conversation:', data.init.userIntroMessage);

          // גלילה להודעה החדשה
          setTimeout(() => {
            this.scrollToLastMessage();
          }, 100);
        } else {
          console.error('No welcome message received from server');
        }
      },
      error: (err: any) => {
        console.error('Error creating new conversation:', err);
        // אפשר להציג הודעת שגיאה למשתמש
      }
    });
  }

  isImage(icon: string | undefined): boolean {
    return typeof icon === 'string' && (icon.endsWith('.png') || icon.endsWith('.jpg') || icon.endsWith('.jpeg') || icon.endsWith('.webp'));
  }

  // קבלת שם יועץ
  getAdvisorName(advisorId: AdvisorId | undefined): string {
    const advisor = this.getAdvisor(advisorId);
    return advisor ? advisor.name : 'יועץ';
  }

  // קבלת צבע יועץ
  getAdvisorColor(advisorId: AdvisorId | undefined): string {
    const advisor = this.getAdvisor(advisorId);
    return advisor ? advisor.color : 'bg-advisor-default';
  }

  sanitize(text: string): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(text);
  }

  getIconPath(icon: string | undefined): string {
    if (!icon) return '🧠'; // אייקון ברירת מחדל

    // אם האייקון הוא כבר נתיב מלא (מתחיל ב-http) - החזר אותו כמו שהוא
    if (icon.startsWith('http')) {
      return icon;
    }

    // אם האייקון הוא נתיב יחסי
    if (icon.startsWith('/')) {
      // הסר את ה-/ הראשון אם קיים, כי הוא כבר כלול בנתיב הבסיס
      const cleanPath = icon.startsWith('/') ? icon.substring(1) : icon;
      return `assets/images/${cleanPath}`;
    }

    // אחרת, זה כנראה אמוג'י - החזר כמו שהוא
    return icon;
  }

  get isLoading(): boolean {
    return this._isLoading;
  }
  set isLoading(value: boolean) {
    this._isLoading = value;
    // בכל פעם שמשנים את מצב הטעינה, מבצעים גלילה
    if (value) { // אם הטעינה מתחילה
      this.scrollToLastMessage();
    }
  }

  /**
   * שליחת הודעה לשרת והצגת תשובה
   */
  sendMessage(): void {
    // בדיקה אם ההודעה ריקה ואין דגל למעבר אוטומטי
    const msg = this.inputText.trim();
    if (!msg && !this.forceAdvisorSwitch) return;

    console.log('Sending message, forceAdvisorSwitch:', this.forceAdvisorSwitch);

    // שמירת מצב הדגל ואיפוס
    const forceSwitch = this.forceAdvisorSwitch;
    this.forceAdvisorSwitch = false;

    // הוספת הודעת המשתמש לשיחה (רק אם יש הודעה)
    if (msg) {
      this.conversation.push({ text: this.inputText, sender: 'user' });
      // גלילה מיידית אחרי הוספת הודעת המשתמש
      this.scrollToLastMessage();
    }

    // ניקוי תיבת הטקסט
    const sentMessage = this.inputText;
    this.inputText = '';

    // סימון מצב טעינה
    this.isLoading = true;

    // אינדיקציה ויזואלית שהמערכת מקלידה תשובה
    const typingMessageIndex = this.conversation.push({
      text: 'מקליד...',
      sender: 'system',
      advisorId: this.lastAdvisorId
    }) - 1;

    // גלילה שוב להראות את הודעת ה"מקליד..."
    setTimeout(() => {
      this.scrollToLastMessage();
    }, 100);

    // שליחת ההודעה לשרת
    this.advisorService.sendMessage(sentMessage || 'המשך', this.conversationId || undefined, this.lastNextAdvisorId/*this.chatSession.getAdvisorId() as AdvisorId*/).pipe(
      finalize(() => {
        this.isLoading = false;
        // הסרת הודעת ה"מקליד..." בכל מקרה
        if (typingMessageIndex >= 0) {
          this.conversation.splice(typingMessageIndex, 1);
        }
      })
    ).subscribe({
      next: (response: { success: any; response: ChatMessage; mapalScore?: Record<string, number> }) => {
        if (response.success && response.response) {
          // עדכון ציוני מפ"ל בזמן אמת
          if (response.mapalScore && Object.keys(response.mapalScore).length > 0) {
            this.mapalScore = { ...response.mapalScore };
          }

          // שמירת מזהה היועץ האחרון אם קיים
          if (response.response.advisorId) {
            this.lastAdvisorId = response.response.advisorId;
            console.log('Updated lastAdvisorId:', this.lastAdvisorId);
          }

          // אם יש יועץ חדש – נעדכן את הודעת המערכת בהתאם
          if (response.response.nextAdvisor && response.response.nextAdvisor.advisorId) {
            response.response.advisorId = response.response.nextAdvisor.advisorId;
            response.response.advisorId = response.response.nextAdvisor.advisorId ?? response.response.advisorId;
            this.lastNextAdvisorId = response.response.nextAdvisor.advisorId;
          }

          this.conversation.push(response.response);

          // גלילה מיידית להראות את התשובה החדשה
          setTimeout(() => {
            this.scrollToLastMessage();
          }, 50);

          // בדיקה אם יש מעבר מתוכנן ליועץ אחר
          if (response.response.nextAdvisor && response.response.nextAdvisor.advisorId && this.lastAdvisorId != response.response.nextAdvisor.advisorId) {
            this.lastAdvisorId = response.response.nextAdvisor.advisorId;
            console.log('Next advisor detected:', response.response.nextAdvisor.advisorId);

            // סימון שצריך להפעיל את היועץ הבא אוטומטית
            /*  this.forceAdvisorSwitch = true;
 
             // הפעלה אוטומטית של המעבר ליועץ הבא אחרי קצת השהייה
             setTimeout(() => {
               console.log('Auto-switching to next advisor');
               // וידוא שהדגל עדיין פעיל לפני הקריאה
               if (this.forceAdvisorSwitch) {
                 this.sendMessage();
               }
             }, 1000); // השהייה של שנייה אחת כדי לאפשר למשתמש לקרוא את ההודעה */
          }


          // גלילה להראות את הודעת השגיאה
          setTimeout(() => {
            this.scrollToLastMessage();
            this.myInputRef.nativeElement.focus();
          }, 100);
        } else {
          console.error('Invalid response format:', response);
          // הוספת הודעת שגיאה ידידותית למשתמש
          this.conversation.push({
            text: 'סליחה, אירעה שגיאה. נסה שוב מאוחר יותר.',
            sender: 'system',
            advisorId: 'strategy'
          });

        }
      },
      error: (err: any) => {
        console.error('Error sending message:', err);
        // הוספת הודעת שגיאה ידידותית למשתמש
        this.conversation.push({
          text: 'סליחה, נראה שיש בעיה בתקשורת עם השרת. נסה שוב מאוחר יותר.',
          sender: 'system',
          advisorId: 'strategy'
        });

        // גלילה להראות את הודעת השגיאה
        setTimeout(() => {
          this.scrollToLastMessage();
        }, 100);
      }
    });
  }

  /**
 * מבצע פורמט לטקסט ההודעה - מבטיח שיהיה בשורות מסודרות
 */
  formatMessageText(text: string): string {
    // אם הטקסט כבר מכיל HTML, לא לבצע עיבוד נוסף כדי למנוע פגיעה בפורמט
    if (text.includes('<div') || text.includes('<p') || text.includes('<br')) {
      return text;
    }

    // פיצול הטקסט לפסקאות (לפי שורות ריקות)
    const paragraphs = text.split(/\n\s*\n/);

    // אם יש פסקה אחת בלבד, אפשר לבדוק אם יש צורך בחלוקה לשורות בודדות
    if (paragraphs.length === 1 && text.length > 100) {
      // חלוקה למשפטים לפי נקודות ושאלות
      const sentences = text.split(/(?<=[.?!])\s+/);

      // אם יש יותר ממשפט אחד, חלק לשורות
      if (sentences.length > 1) {
        // הוספת תג <br> בין משפטים
        return sentences.join('<br><br>');
      }

      // אם זה משפט ארוך אחד, חלק לפי פסיקים או נקודות-פסיק
      if (sentences[0].length > 100) {
        return sentences[0].split(/(?<=,|;)\s+/).join('<br>');
      }
    }

    // חיבור הפסקאות בחזרה עם תגי <p>
    return paragraphs.map(p => `<p>${p}</p>`).join('');
  }

  /**
   * החלפת שיחה נוכחית ויצירת שיחה חדשה
   */
  startNewConversation(): void {

    this.chatSession.resetSession();
    // ניקוי הנתונים הקיימים
    this.conversationId = null;
    localStorage.removeItem('currentConversationId');

    // איפוס השיחה להודעת פתיחה
    this.conversation = [];

    /* this.conversation = [
      {
        text: `# 👨‍💼 אופק – מנהל יועצים פיננסיים

## ברוכים הבאים ל"אופק פיננסי 360°"

שלום! אני **אופק**, מנהל צוות היועצים הפיננסיים שלנו.

אשמח ללוות אותך בבניית תמונה פיננסית כוללת המותאמת לצרכים האישיים שלך. בעזרת צוות של 17 יועצים מומחים, נוכל לתכנן יחד את כל טווחי הזמן - מהתקציב החודשי השוטף, דרך החלטות קריירה ועד תכנון פרישה הוליסטי.

### לפני שנתחיל, אשמח להכיר אותך קצת:

1. **איך תרצה/י שאפנה אליך?** (שם)
2. **מה גילך כיום?**
3. **מה המצב המשפחתי שלך?** (רווק/ה, נשוי/אה, גרוש/ה, עם ילדים וכו')
4. **האם את/ה עובד/ת כשכיר/ה או עצמאי/ת?**

לאחר שנכיר, נוכל להתאים לך את הייעוץ הפיננסי הטוב ביותר, בהתאם לשלב החיים ולמטרות שלך. אני כאן כדי לכוון אותך ליועצים המתאימים בדיוק לצרכים שלך.`,
        sender: 'system',
        advisorId: 'strategy'
      }
    ]; */

    // יצירת שיחה חדשה
    this.createNewConversation();
  }

  /**
 * פונקציה משופרת לגלילה לאלמנט האחרון או לאינדיקטור הטעינה
 * עם ניסיונות חוזרים כדי להבטיח גלילה תקינה
 */
  private scrollToLastMessage(maxAttempts: number = 5): void {
    // מונה ניסיונות
    let attempts = 0;

    // פונקציה רקורסיבית שמנסה לגלול
    const tryScroll = () => {
      attempts++;


      // נסה למצוא קודם את האינדיקטור אם הוא קיים
      const indicator = document.querySelector('.py-6');

      // אם מצאנו אינדיקטור, גלול אליו
      if (indicator && this.isLoading) {
        console.log('מגלגל לאינדיקטור');
        indicator.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return; // הצלחנו לגלול לאינדיקטור
      }

      // אם אין אינדיקטור, נסה למצוא את ההודעה האחרונה
      const messages = document.querySelectorAll('.message-bubble');
      if (messages.length > 0) {
        const lastMessage = messages[messages.length - 1];
        console.log('מגלגל להודעה האחרונה', lastMessage);
        lastMessage.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return; // הצלחנו לגלול להודעה האחרונה
      }

      // אם לא הצלחנו למצוא הודעה או אינדיקטור, ננסה לגלול לתחתית הקונטיינר
      const chatContainer = document.querySelector('.conversation-container');
      if (chatContainer) {
        console.log('מגלגל לתחתית הקונטיינר');
        chatContainer.scrollTop = chatContainer.scrollHeight;
      }

      // בדיקה אם הגלילה הייתה מושלמת
      if (chatContainer) {
        const isAtBottom = Math.abs(
          (chatContainer.scrollHeight - chatContainer.clientHeight) - chatContainer.scrollTop
        ) < 10; // סף של 10 פיקסלים

        // אם לא הגענו לתחתית ועדיין יש ניסיונות, ננסה שוב אחרי השהייה
        if (!isAtBottom && attempts < maxAttempts) {
          console.log(`ניסיון גלילה ${attempts} לא הצליח, מנסה שוב...`);
          setTimeout(tryScroll, 200 * attempts); // השהייה ארוכה יותר בכל ניסיון
        }
      }
    };

    // התחל את הגלילה
    tryScroll();
  }

  /**
   * פונקציה חלופית עם גישה אגרסיבית יותר לגלילה לתחתית
   * במקרה שהגישה הרגילה לא עובדת
   */
  private forceScrollToBottom(): void {
    // נסה 3 גלילות עם השהיות הולכות וגדלות
    setTimeout(() => {
      const container = document.querySelector('.conversation-container');
      if (container) container.scrollTop = container.scrollHeight;
    }, 50);

    setTimeout(() => {
      const container = document.querySelector('.conversation-container');
      if (container) container.scrollTop = container.scrollHeight;
    }, 200);

    setTimeout(() => {
      const container = document.querySelector('.conversation-container');
      if (container) container.scrollTop = container.scrollHeight;
    }, 500);
  }

  /**
   * פונקציה משופרת לגלילה לאינדיקטור הטעינה
   * עם התייחסות למצב האינדיקטור בדף
   */
  private scrollToLoadingIndicator(): void {
    // קריאה לפונקציה הכללית שמטפלת בגלילה
    this.scrollToLastMessage();

    // גיבוי - גלילה אגרסיבית לתחתית לאחר השהייה קצרה
    setTimeout(() => {
      this.forceScrollToBottom();
    }, 100);
  }

  /**
   * פונקציית עזר לגלילה לסוף השיחה
   */
  private scrollToBottom(delay: number = 150): void {
    // גלילה מיידית
    this.doScroll();

    // גלילה שוב אחרי השהייה קצרה (ברירת מחדל: 50ms)
    // זה יבטיח שהגלילה תפעל גם אחרי שהאינדיקטור או תוכן נוסף נוסף לDOM
    setTimeout(() => {
      this.doScroll();
    }, delay);
  }

  /**
   * מבצע את פעולת הגלילה עצמה
   */
  private doScroll(): void {
    const chatContainer = document.querySelector('.conversation-container');
    if (chatContainer) {
      chatContainer.scrollTop = chatContainer.scrollHeight;
    }
  }

  getAdvisor(advisorId?: AdvisorId) {
    return advisorId ? this.advisors[advisorId] : undefined;
  }

  getLastUserMessage(): ChatMessage | undefined {
    // הולך מהסוף להתחלה ומחזיר את ההודעה האחרונה של המשתמש
    for (let i = this.conversation.length - 1; i >= 0; i--) {
      if (this.conversation[i].sender === 'user') {
        return this.conversation[i];
      }
    }
    return undefined;
  }

}