

import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideMarkdown } from 'ngx-markdown';
import katex from 'marked-katex-extension';

import { routes } from './app.routes';
import { provideHttpClient, withFetch, withInterceptorsFromDi } from '@angular/common/http';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideHttpClient(withInterceptorsFromDi()),
    provideMarkdown({
      markedExtensions: [
        katex({
          throwOnError: false,
          displayMode: false,
          output: 'html',
          strict: false,
          trust: true,
          nonStandard: true
        })
      ]
    })
  ]
};


