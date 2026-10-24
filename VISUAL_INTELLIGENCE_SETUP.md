# TONY Visual Intelligence

TONY Studio now searches for archive/stock photographs and generates **clearly labeled conceptual illustrations** based on the article headline and summary. Every selected image requires editorial approval before publication.

## Available sources

- **Wikimedia Commons:** Works once TONY_SESSION_SECRET is set. Searches images and returns file/source pages, credits, explicit licenses, preview and a signed media import. Currently suggests CC BY / CC BY-SA / CC0 / public-domain files only. License filtering is not a legal guarantee.
- **Pexels:** Optional stock search after PEXELS_API_KEY is set. Always open the photo page and check its license, models and trademarks; use photographer credit. A stock photograph is not evidence of the described event.
- **Google Gemini:** Optional AI conceptual illustration generation. Uses model gemini-nano-banana-2.1 (or gemini-3.1-flash-lite-image). These are illustrations, not photographs. The final actual canvas and Instagram caption contain explicit AI disclosure.

## Vercel Production environment

| Variable | Purpose |
|---|---|
| TONY_SESSION_SECRET | REQUIRED existing 32+ character server secret: signed images and encrypted admin sessions |
| PEXELS_API_KEY | OPTIONAL from https://www.pexels.com/api/ |
| GEMINI_API_KEY | OPTIONAL from https://aistudio.google.com/apikey |
| TONY_VISUAL_PASSWORD | Password of 16+ characters to unlock paid Gemini generation; if absent, existing TONY_ADMIN_PASSWORD can be used instead |
| INSTAGRAM_REDIRECT_URI | Existing production OAuth URI: used to validate same-origin request |
| GEMINI_IMAGE_MODEL | OPTIONAL default gemini-nano-banana-2.1, alternative gemini-3.1-flash-lite-image |

Add secrets in Vercel, NOT in GitHub, this chat or client-side JavaScript. Redeploy Production after changing the environment.

## Workflow

1. Import a news article into TONY Studio or enter headline, summary and borough.
2. On Design, open Upload Photo → TONY Visual Intelligence.
3. Press Use story keywords, refine the query, search Wikimedia Commons (or Pexels with API key).
4. Review copyright/credit and photo relevance. Select Use this photo. The image imports into the existing crop/filter and canvas pipeline; photo rights are set to **unreviewed** until the editor confirms them.
5. Or unlock Gemini with the separately created Visual Studio password and choose Generate AI Illustration. Each generation requires explicit confirmation (charges may apply). The prompt requests abstract conceptual art, not actual news events or specific public figures.
6. Review and approve article source, photo rights, caption and AI disclosure before publishing via Instagram. The existing PNG / Draft Grid paths continue to work.

## Editorial safeguards

- Neither stock photos nor archival photos prove a specific news event happened. Never caption one as if it depicts the live event unless independently verified.
- Wikimedia licensing metadata and Pexels licenses require human review; check each photo and required credit. Images featuring identifiable people, trademarks or private property may carry additional restrictions.
- AI illustrations are marked **AI ILLUSTRATION** on the actual canvas, including PNG and Instagram JPEG, with an AI disclosure in captions.
- API image generation is gated behind an encrypted HttpOnly password-unlocked session.
- Image import URLs are signed and time-limited, fetched only from approved media hosts with maximum 2.4 MB response.
- Newsroom browser-local drafts store text and image provenance, not binary photos: re-import the image before reuse.
- User-uploaded original photos are not sent to Gemini.
- Gemini is a paid external dependency and must have GEMINI_API_KEY configured.

## Tests

Run: npm install; npm run check; npm test.

References: https://ai.google.dev/gemini-api/docs/image-generation ; https://www.mediawiki.org/wiki/API:Imageinfo ; https://www.pexels.com/api/documentation/
