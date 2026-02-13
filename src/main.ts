// src/main.ts
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';

// הוספת לוגים מפורטים לשלבי הטעינה
console.log('Angular bootstrap starting');

// לכידת שגיאות גלובליות
window.onerror = function(message, source, lineno, colno, error) {
  console.error('Global error caught:', message);
  console.error('Error source:', source);
  console.error('Error details:', { lineno, colno });
  console.error('Error stack:', error?.stack);
  
  // הצגת שגיאה על המסך למשתמש
  const loadingElement = document.querySelector('.loading-container p');
  if (loadingElement) {
    loadingElement.textContent = 'אירעה שגיאה בטעינת האפליקציה. אנא נסה לרענן את הדף.';
  }
  
  return false;
};

// הוספת לכידת שגיאות Promise לא מטופלות
window.addEventListener('unhandledrejection', function(event) {
  console.error('Unhandled Promise Rejection:', event.reason);
});

// תוספת לוגים לשלבי הבוטסטרפ
//console.log('App config:', JSON.stringify(appConfig));

// ניסיון אתחול עם ניטור מורחב
bootstrapApplication(AppComponent, appConfig)
  .then(() => {
    console.log('Angular bootstrap completed successfully');
  })
  .catch((err) => {
    console.error('Bootstrap error details:', err);
    
    // ניסיון להציג פרטי שגיאה ממוקדים יותר
    if (err.message) console.error('Error message:', err.message);
    if (err.stack) console.error('Error stack:', err.stack);
    if (err.ngDebugContext) console.error('Angular debug context:', err.ngDebugContext);
    if (err.ngErrorLogger) err.ngErrorLogger(console.error, err);
    
    // הצגת שגיאה על המסך למשתמש
    const loadingElement = document.querySelector('.loading-container p');
    if (loadingElement) {
      loadingElement.textContent = 'אירעה שגיאה בטעינת האפליקציה. אנא נסה לרענן את הדף.';
    }
  });

  console.log('main.js script exists:');