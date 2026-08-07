/**
 * YouTube Data API v3 integration. Requires OAuth credentials — see
 * docs/CAHIER_DES_CHARGES.md section 8 and scripts/authorize.ts.
 */
export type { VideoVisibility, UploadVideoParams, YoutubeClient } from "./types.js";
export {
  createOAuth2Client,
  YOUTUBE_OAUTH_SCOPES,
  YOUTUBE_LOOPBACK_REDIRECT_PORT,
  YOUTUBE_LOOPBACK_REDIRECT_URI,
  type YoutubeOAuthConfig,
} from "./oauth-client.js";
export { createYoutubeClient } from "./client.js";
