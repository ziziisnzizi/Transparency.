# Product questions with Gemini

Product detail → 질문하기 contains the question form, recommended questions,
answers, citations, cancellation/retry controls, and the existing FAQ.

## Enable Gemini on Vercel

1. Create a Gemini API key in [Google AI Studio](https://aistudio.google.com/apikey).
2. Open the Vercel project serving the intended production domain → Settings → Environment Variables. Set
   `GEMINI_API_KEY` for Production and Preview as needed. Enter the real value
   only in that settings screen; never put it in a chat, source file, or `VITE_`
   variable. `GOOGLE_API_KEY` is accepted as a server-side fallback.
3. Redeploy the project so its server function receives the variable.

The existing shared domain `transparency-web-five.vercel.app` is served by the
`transparency-web` project. The separate `transparency` project serves
`transparency-six.vercel.app`; their environment variables are independent.

Optional `GEMINI_MODEL` defaults to `gemini-3.8-flash`. The model is configurable
with a model identifier, not an arbitrary API URL. The provider host is fixed to
Google's Gemini API and the key travels in the `x-goog-api-key` header. Current
models use the Interactions API with `store: false`; explicitly selected
`gemini-2.*` models retain the legacy generateContent adapter.

`GET /api/ask` returns `{ aiAvailable, mode }`. This checks configuration presence,
not provider authorization or remaining quota. A successful POST with `mode: ai`
demonstrates that a Gemini answer was returned. A configured but unavailable
provider returns an explicitly labelled reference answer instead. A failed
provider request includes only an allowlisted `providerIssue` category, never
the upstream error text, key, prompt, or model configuration.

## Local development

Copy `.env.example` to `.env.local`, enter the key there, and run `npm run dev`.
Both Vite dev and preview serve `/api/ask` through the same server handler.
Local environment files are ignored by Git. Never expose the key in frontend
environment variables or paste it into a browser form.

Without a key, registered product questions still work in `reference` mode.
The UI labels this as 제품 자료 답변 and says Gemini is not connected. It is not
presented as an AI-generated answer.

## Grounding and limits

- Shared `products.js` supplies the site's product facts and pricing; the
  server adds published usage, safety, evidence-scope, and question-privacy data.
- POST accepts only `{ productSlug, question }`, with a 500-character question
  limit and a 4,096-byte body limit. It never accepts client-provided facts,
  delivery details, reviews, secrets, or arbitrary conversation roles.
- Answers use only registered sources. Unknown facts remain unknown; ingredient
  studies are distinguished from finished-product test results. No clinical,
  fragrance, expiry, dosage-frequency, or personal suitability claims are invented.
- Unsupported topics return reference guidance without calling Gemini.
- Generated JSON must cite 1–6 valid sources from the selected product. Invalid
  citations, blocked/truncated responses, provider errors, and timeouts fall back
  to registered materials, with the response mode accurately labelled.
- The provider timeout is 20 seconds; the Vercel function duration is 30 seconds.
  A per-instance address limit is 20 POST requests per minute. This is not a
  persistent distributed abuse-control service.

## Data handling

Questions and product data are transmitted to the application server. When
Gemini is configured and the topic is supported, they are forwarded to Google.
The app writes neither questions nor answers to browser storage or a database.
It does not log prompts or provider credentials. Dialogues exist in page memory,
are isolated by product, and clear on reload or through 대화 지우기. Each request
is independent; previous dialogue is not sent as model conversation history.

API responses use `Cache-Control: no-store`. The browser receives answers and
registered citations, never the provider key. Google's own service data policies
apply to requests sent to Gemini; application-level non-persistence does not
claim zero provider retention.

## Hosting

The production site uses Vercel's `api/ask.js` server function alongside the Vite
build. A static-only deployment, including the existing Netlify static build
configuration, needs an equivalent API adapter to provide question answers.

## Provider references

- [Interactions API](https://ai.google.dev/api/interactions-api)
- [Legacy generateContent API](https://ai.google.dev/api/generate-content)
- [Gemini models](https://ai.google.dev/gemini-api/docs/models)
- [Model lifecycle](https://ai.google.dev/gemini-api/docs/deprecations)
