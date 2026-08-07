import { createServer } from "node:http";
import {
  createOAuth2Client,
  YOUTUBE_LOOPBACK_REDIRECT_PORT,
  YOUTUBE_LOOPBACK_REDIRECT_URI,
  YOUTUBE_OAUTH_SCOPES,
} from "../src/oauth-client.js";

const clientId = process.env["YOUTUBE_CLIENT_ID"];
const clientSecret = process.env["YOUTUBE_CLIENT_SECRET"];

if (!clientId || !clientSecret) {
  console.error(
    "Set YOUTUBE_CLIENT_ID and YOUTUBE_CLIENT_SECRET in your .env before running this.",
  );
  process.exit(1);
}

const oauth2Client = createOAuth2Client({
  clientId,
  clientSecret,
  redirectUri: YOUTUBE_LOOPBACK_REDIRECT_URI,
});

const authUrl = oauth2Client.generateAuthUrl({
  access_type: "offline",
  scope: [...YOUTUBE_OAUTH_SCOPES],
  prompt: "consent",
});

console.log(
  "Open this URL and authorize with the Google account that owns the target YouTube channel:\n",
);
console.log(authUrl, "\n");
console.log("Waiting for the authorization redirect...");

const authorizationCode = await new Promise<string>((resolve, reject) => {
  const server = createServer((req, res) => {
    const url = new URL(req.url ?? "/", YOUTUBE_LOOPBACK_REDIRECT_URI);
    const code = url.searchParams.get("code");
    const error = url.searchParams.get("error");

    if (error) {
      res.writeHead(400, { "Content-Type": "text/plain" }).end(`Authorization denied: ${error}`);
      server.close();
      reject(new Error(`Authorization denied: ${error}`));
      return;
    }
    if (!code) {
      res.writeHead(400, { "Content-Type": "text/plain" }).end("Missing authorization code.");
      return;
    }

    res
      .writeHead(200, { "Content-Type": "text/plain" })
      .end("Authorization received, you can close this tab.");
    server.close();
    resolve(code);
  });
  server.listen(YOUTUBE_LOOPBACK_REDIRECT_PORT);
});

const { tokens } = await oauth2Client.getToken(authorizationCode);

if (!tokens.refresh_token) {
  console.error(
    "\nNo refresh token was returned (Google only issues one the first time an app is authorized).",
    "\nRevoke this app's access at https://myaccount.google.com/permissions and run this script again.",
  );
  process.exit(1);
}

console.log("\nAuthorization successful. Add this line to your .env file:\n");
console.log(`YOUTUBE_REFRESH_TOKEN=${tokens.refresh_token}`);
