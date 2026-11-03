import { defineConfig, loadEnv } from 'vite';
import ask from './api/ask.js';
import concernNews from './api/concern-news.js';

function attachQuestionApi(server) {
  server.middlewares.use((request, response, next) => {
    const path = request.url?.split('?')[0];
    if (path === '/api/ask') return ask(request, response);
    if (path === '/api/concern-news') return concernNews(request, response);
    return next();
  });
}

export default defineConfig(({ mode }) => {
  const local = loadEnv(mode, process.cwd(), ['GEMINI_', 'GOOGLE_API_KEY']);
  for (const name of ['GEMINI_API_KEY', 'GOOGLE_API_KEY', 'GEMINI_MODEL']) {
    if (!process.env[name] && local[name]) process.env[name] = local[name];
  }
  return {
    plugins: [{ name: 'product-question-api', configureServer: attachQuestionApi, configurePreviewServer: attachQuestionApi }],
  };
});
