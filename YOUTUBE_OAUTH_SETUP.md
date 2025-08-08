# YouTube OAuth Configuration

To enable automatic YouTube subscription fetching, you need to set up YouTube OAuth credentials.

## Setup Instructions:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the YouTube Data API v3
4. Go to "Credentials" and create OAuth 2.0 Client IDs
5. Set the authorized redirect URI to: `http://localhost:3000/auth/youtube/callback` (or your production URL)
6. Add the following environment variables to your `.env` file:

```
# YouTube OAuth Configuration
YOUTUBE_CLIENT_ID=your_client_id_here
YOUTUBE_CLIENT_SECRET=your_client_secret_here
YOUTUBE_REDIRECT_URI=http://localhost:3000/auth/youtube/callback
YOUTUBE_API_KEY=your_api_key_here
```

## Frontend Integration:

The frontend needs to handle the OAuth flow:

1. Call `/api/oauth/youtube/auth-url` to get the authorization URL
2. Redirect user to the authorization URL
3. Handle the callback with the authorization code
4. Send the code to `/api/oauth/youtube/callback` to complete the connection

## Automatic Subscription Sync:

Once a user connects their YouTube account:
- Subscriptions are automatically fetched and added to their account
- Subscriptions are synced again every time they login
- Manual sync is available via `/api/oauth/youtube/sync-subscriptions`
- Connection status can be checked via `/api/oauth/youtube/status`
