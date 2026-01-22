# Advertisement System Routes

This document describes the advertisement system routes in AgApp and how to use them.

## Route Structure

The advertisement system has three main route groups:

### 1. Admin Routes (Backend Management)
**Prefix:** `/ads-admin`

Used by system administrators to manage advertisements.

Endpoints:
- `GET /ads-admin/locations` - List all ad locations
- `POST /ads-admin/upload/{location}` - Upload ad files (HTML, CSS, JS, images)
- `DELETE /ads-admin/delete-all/{location}` - Delete all files for a location
- `DELETE /ads-admin/delete-file/{location}/{filename}` - Delete specific file
- `GET /ads-admin/preview/{location}` - Preview ad content

### 2. Static File Serving
**Prefix:** `/ads`

Serves the actual ad content as static files.

- `/ads/{location}/index.html` - Main HTML file for the ad
- `/ads/{location}/*` - Other assets (CSS, JS, images)

### 3. Mobile API Routes (Public)
**Prefix:** `/system-admin/api/public/ads`

Public API endpoints used by the mobile application.

Endpoints:
- `GET /system-admin/api/public/ads/{ad_type}/check` - Check if ad exists
- `GET /system-admin/api/public/ads/{ad_type}` - Get ad content (HTML + assets)
- `POST /system-admin/api/public/ads/click/{ad_type}` - Track ad click
- `POST /system-admin/api/public/ads/impression/{ad_type}` - Track ad impression

## Ad Locations (Types)

There are 4 fixed ad locations:

1. `publi_screen_client` - Full-screen ad shown to clients
2. `publi_screen_professional` - Full-screen ad shown to professionals
3. `banner_client_home` - Banner on client home screen
4. `banner_professional_home` - Banner on professional home screen

## Mobile Integration

### Fetching Ads

The mobile app should fetch ads using the mobile API:

```typescript
// Check if ad exists
const checkResponse = await client.get(
  `/system-admin/api/public/ads/publi_screen_client/check`
);

if (checkResponse.data.exists) {
  // Get ad content
  const adResponse = await client.get(
    `/system-admin/api/public/ads/publi_screen_client`
  );
  
  // adResponse.data contains:
  // - html: HTML content
  // - css: CSS content
  // - js: JavaScript content
  // - images: Object with image URLs
}
```

### Tracking Impressions

When an ad is displayed to the user:

```typescript
// Track that the ad was shown
await client.post(
  `/system-admin/api/public/ads/impression/publi_screen_client`
);
```

### Tracking Clicks

When a user clicks/interacts with an ad:

```typescript
// Track the click
await client.post(
  `/system-admin/api/public/ads/click/publi_screen_client`
);
```

## Analytics

Ad impressions and clicks are logged to separate files for analytics:

- **Impressions:** `logs/ad_impressions.log`
- **Clicks:** `logs/ad_clicks.log`

Each log entry is a JSON object with:
```json
{
  "timestamp": "2025-01-22T15:30:00.000Z",
  "ad_type": "publi_screen_client",
  "client_ip": "192.168.1.1",
  "user_agent": "AgApp/1.0 (iOS)"
}
```

### Viewing Analytics

To view analytics, you can parse the log files:

```bash
# Count impressions per ad type
cat logs/ad_impressions.log | jq -r '.ad_type' | sort | uniq -c

# Count clicks per ad type
cat logs/ad_clicks.log | jq -r '.ad_type' | sort | uniq -c

# Calculate click-through rate (CTR)
impressions=$(wc -l < logs/ad_impressions.log)
clicks=$(wc -l < logs/ad_clicks.log)
echo "scale=2; $clicks * 100 / $impressions" | bc

# View clicks in the last hour
cat logs/ad_clicks.log | jq -r 'select(.timestamp > "'$(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S)'Z")'
```

### Future: Admin Dashboard

A future enhancement could add admin endpoints to view these analytics:

```
GET /ads-admin/analytics/summary
- Returns impression/click counts for each ad type
- Returns CTR for each ad type
- Returns time-series data

GET /ads-admin/analytics/impressions
- Returns detailed impression log with filters

GET /ads-admin/analytics/clicks  
- Returns detailed click log with filters
```

## Upload Requirements

### Banner Ads
- **Aspect ratio:** 3:1 (e.g., 1200x400 pixels)
- **Minimum:** 2.5:1
- **Tolerance:** 5%
- **Format:** HTML + optional CSS/JS/images

### Full-Screen Ads
- Can be any dimensions
- Should be responsive to work on different screen sizes
- Format: HTML + optional CSS/JS/images

## Security Notes

1. **Public endpoints** (`/system-admin/api/public/ads`) do not require authentication
2. **Admin endpoints** (`/ads-admin`) require admin authentication
3. Ad content is served as static files, so avoid including sensitive data
4. JavaScript in ads runs in the mobile app context - keep it minimal and safe

## Migration Notes

If you have old code using the deprecated route:
- Old: `POST /ads/public/click/{location}`
- New: `POST /system-admin/api/public/ads/click/{ad_type}`

Update your mobile app to use the new route structure.
