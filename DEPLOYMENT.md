# Stream Engine — Deployment Guide

This guide covers deploying the frontend to Vercel and hosting the backend locally with a Cloudflare Tunnel for secure, multi-origin HTTPS access.

## Architecture

- **Frontend**: Deployed on Vercel, accessible globally.
- **Backend (Signaling & Room State)**: Self-hosted via Node.js + Express + Socket.IO.
- **Real-Time Data**: Socket.IO connections proxy through Cloudflare Tunnel.
- **Media (Video/Audio)**: WebRTC creates peer-to-peer mesh networks directly between clients. The backend only handles signaling (SDP/ICE exchanges).

---

## 1. Backend Setup (Local / Self-Hosted)

### Prerequisites
- Node.js v18+
- Cloudflared CLI installed (`cloudflared`)
- Firebase Service Account JSON file

### Configuration
1. Navigate to the `backend/` directory.
2. Ensure your Firebase credential file is placed in `backend/` as `service account.json` (or name it appropriately and match it in `.env`).
3. Setup the `backend/.env` file:
   ```env
   PORT=8080
   FRONTEND_URL=http://localhost:3000,https://YOUR_VERCEL_APP_URL.vercel.app,https://YOUR_CUSTOM_FRONTEND_DOMAIN.com
   FIREBASE_SERVICE_ACCOUNT=./service account.json
   ```

### Running the Backend
From the root directory:
```bash
cd backend
npm install
npm run build
npm start
```
*Note: For development, use `npm run dev`.*

---

## 2. Cloudflare Tunnel Configuration

You must expose the `8080` port via Cloudflare to handle HTTPS WebSocket traffic properly.

1. Ensure your `~/.cloudflared/config.yml` is configured to route traffic to `:8080`:
```yaml
tunnel: YOUR_TUNNEL_ID
credentials-file: C:\Users\your_user\.cloudflared\YOUR_TUNNEL_ID.json
protocol: http2

ingress:
  - hostname: back.yourdomain.com
    service: http://localhost:8080
    originRequest:
      noTLSVerify: true
      httpHostHeader: back.yourdomain.com # Important for strict routing
  - service: http_status:404
```

2. Start the tunnel:
```bash
cloudflared tunnel run
```

---

## 3. Frontend Deployment (Vercel)

1. Connect your GitHub repository to Vercel.
2. In the Vercel project settings, set the **Root Directory** to `frontend`.
3. Configure the following Environment Variables in Vercel:
   ```env
   NEXT_PUBLIC_FIREBASE_API_KEY=your_key
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_domain
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_id
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_bucket
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender
   NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
   NEXT_PUBLIC_BACKEND_URL=https://back.yourdomain.com # Your Cloudflare Tunnel URL
   ```
4. Deploy the application.

---

## Troubleshooting

- **Socket Authentication Fails**: Verify the `FIREBASE_SERVICE_ACCOUNT` path has no typos and is valid JSON.
- **WebRTC Fails to Connect**: WebRTC requires HTTPS/WSS in production browsers. Both the Vercel frontend and Cloudflare tunnel backend MUST be accessed via secure `https://` protocols.
- **CORS Errors**: Ensure the frontend's deployed URL is added comma-separated in the `FRONTEND_URL` backend env variable.
