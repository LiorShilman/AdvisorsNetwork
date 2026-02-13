// script-loader.js - הוסף קובץ זה לתיקיית הפרסום
(function() {
    // רשימת הקבצים העיקריים
    const mainScripts = [
      'runtime.js',
      'polyfills.js',
      'main.js'
    ];
    
    // בדיקה אם הסקריפט כבר נטען
    function isScriptLoaded(src) {
      return Array.from(document.scripts).some(script => 
        script.src.includes(src.replace('.js', ''))
      );
    }
    
    // טעינת סקריפט עם promise
    function loadScript(src) {
      if (isScriptLoaded(src)) {
        console.log(`Script ${src} already loaded`);
        return Promise.resolve();
      }
      
      return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.onload = () => {
          console.log(`Loaded: ${src}`);
          resolve();
        };
        script.onerror = (error) => {
          console.error(`Error loading ${src}:`, error);
          reject(error);
        };
        document.body.appendChild(script);
      });
    }
    
    // טען את כל הסקריפטים באופן סדרתי
    async function loadAllScripts() {
      console.log('Starting explicit script loading');
      try {
        for (const scriptSrc of mainScripts) {
          await loadScript(scriptSrc);
        }
        console.log('All scripts loaded successfully');
      } catch (error) {
        console.error('Error loading scripts:', error);
        document.getElementById('loading-message').textContent = 
          'אירעה שגיאה בטעינת האפליקציה. אנא נסה לרענן את הדף.';
        document.getElementById('reload-button').style.display = 'block';
      }
    }
    
    // האזן לאירוע DOMContentLoaded
    document.addEventListener('DOMContentLoaded', function() {
      // בדוק אם האפליקציה לא נטענה עדיין אחרי 2 שניות
      setTimeout(function() {
        if (document.querySelector('app-root').children.length === 1 &&
            document.getElementById('loading-container')) {
          console.log('App not initialized after timeout, trying explicit script loading');
          loadAllScripts();
        }
      }, 2000);
    });
  })();