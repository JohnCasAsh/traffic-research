
  # Traffic Management Dashboard UI

  This is a code bundle for Traffic Management Dashboard UI. The original project is available at https://www.figma.com/design/z4KDQSh2sWExiU5x3SmFKw/Traffic-Management-Dashboard-UI.

  ## Running the code

  Create a .env file (you can copy from .env.example) and set:
  - VITE_API_URL
  - VITE_GOOGLE_MAPS_API_KEY

  Enable these APIs for your Google Maps key:
  - Maps JavaScript API
  - Directions API

  ## Live Tracking (Phase 1)

  The dashboard now supports live traffic tracking and congestion notifications:
  - Toggle Live Tracking in Dashboard to share the current browser location.
  - Backend receives GPS updates at /api/tracking/update.
  - Dashboard subscribes to /api/tracking/stream (Server-Sent Events) for live vehicle markers and alerts.
  - Live path is now rendered segment-by-segment, where each segment keeps its original speed color.
  - Congestion alerts are generated when a tracked vehicle stays below the configured low-speed threshold long enough.
  - Historical segments can be queried from /api/tracking/history.

  Required backend env values are documented in backend/.env.example:
  - TRACKING_TTL_MS
  - TRACKING_DEFAULT_RADIUS_KM
  - CONGESTION_SPEED_KPH
  - CONGESTION_CLEAR_SPEED_KPH
  - CONGESTION_MIN_DURATION_MS
  - TRACKING_SEGMENT_RETENTION_MS
  - TRACKING_HISTORY_DEFAULT_MINUTES
  - TRACKING_HISTORY_MAX_MINUTES

  Run `npm i` to install the dependencies.

  Run `npm run dev` to start the development server.
  