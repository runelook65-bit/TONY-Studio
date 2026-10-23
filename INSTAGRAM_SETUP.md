# TONY Studio — Instagram Direct Publishing

## Status
The code is installed, but live posting requires the owner to configure Meta, Vercel Blob and server-side secrets. Until configured, the interface reports that Instagram is not connected.

## One-time setup

1. Change @theonlynewyork to an Instagram Professional Business or Creator account. Personal accounts are not supported by the official content publishing API.
2. Go to https://developers.facebook.com/apps/ and create/configure an app for Instagram API with Instagram Login (Business Login). Add permissions: instagram_business_basic and instagram_business_content_publish.
3. In the Meta app settings add EXACT redirect URI:
   https://tony-studio-lmeo.vercel.app/api/instagram/callback
4. In the Vercel project serving tony-studio-lmeo.vercel.app create a PUBLIC Vercel Blob store under Storage. Attach it to the same project.
5. In Vercel Project Settings > Environment Variables, set these (Production):

   INSTAGRAM_APP_ID — ID shown in Meta's Instagram Login setup
   INSTAGRAM_APP_SECRET — app secret from Meta
   INSTAGRAM_REDIRECT_URI — https://tony-studio-lmeo.vercel.app/api/instagram/callback
   TONY_SESSION_SECRET — random string at least 32 characters; encrypts secure HttpOnly cookies
   TONY_ADMIN_PASSWORD — strong random password at least 16 characters (not your Instagram password)
   BLOB_READ_WRITE_TOKEN — from the attached PUBLIC Blob store

   Enter secrets directly in Vercel, NEVER in source code, GitHub, screenshots or chat.

6. Redeploy Production after adding env vars. If Meta is in development mode, grant the account an app tester/developer role; broader publishing may require Meta review.
7. Open https://tony-studio-lmeo.vercel.app, unlock the Instagram panel using the separately created studio admin password, and click Instagram Hesabını Bağla to grant access.

## How publishing works
- Write/import a real, reviewed story with HTTPS source URL; verify the information and image license.
- Upload a photograph you own or have licensed.
- Select a verified status and original/licensed image rights in Editorial Control. Set publication status to Yayına hazır.
- Use Açıklamayı Güncelle, proofread the text, check the explicit publishing confirmation, then press Instagram’a Gönder.
- Studio converts the 1080px canvas to JPEG, uploads it to public Vercel Blob (Meta requires a public media URL), creates a Meta media container, checks processing status, then calls media_publish.
- On success it shows the Instagram media ID and, when returned by Meta, the permalink.

## Constraints and security
- Instagram Business Login does not require a linked Facebook Page.
- Instagram tokens are kept server-side in encrypted HttpOnly Secure cookies, never in localStorage or client JavaScript. These tokens expire after about 60 days. Reconnect when necessary; automatic token refresh is not part of this release.
- The optional browser-local Studio draft library does NOT store Instagram credentials.
- The Studio publish endpoints require unlocked admin access and exact-origin checks. A separate strong admin password is essential for a public website.
- Vercel Blob PUBLIC images are accessible to anyone with the URL. Do not upload confidential photos.
- Only single-image Feed posts are supported. Instagram API images must be JPEG. Stories, carousels, Reels and scheduled posts are not included.
- A successfully returned Meta media ID confirms direct publishing; a local grid entry is only a draft preview.
- The editor's reviewed/rights statuses are human assertions, not automatic fact-checking or copyright guarantees.
- If a request fails after Meta may have processed it, check the connected Instagram account before retrying to avoid duplicates.
- Serverless publication is not durable idempotent across devices. For multi-editor enterprise workflows, add a database-backed job and idempotency store.
- Meta publishing limits and access levels depend on current policy. The documented baseline is 100 API-published posts per rolling 24 hours.

## Verification
Run npm install, then npm run check and npm test with Node 20 or later. Check Vercel serverless logs for errors without exposing access tokens.

Documentation:
- https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/content-publishing
- https://vercel.com/docs/vercel-blob/server-upload
