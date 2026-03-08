# Agentic Cooperation API v2 Design

## Overview

Extend Schemata's REST API to support full agentic-human cooperation: graph queries, bulk operations, real-time events, settings control, and export.

## Tier 1: High-Impact Gap Fillers

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/files/:path` | DELETE | Delete a file from disk and memory |
| `/api/files/:path/rename` | PATCH | Rename a file's display name |
| `/api/files/refresh` | POST | Rescan the current folder for new/changed files |
| `/api/canvas/stats` | GET | Node/edge counts by type, dirty files, file count |
| `/api/canvas/nodes/duplicate` | POST | Duplicate nodes with offset, remap edges |
| `/api/canvas/edges/batch` | DELETE | Delete multiple edges by ID list |
| `/api/settings` | GET | Read color mode, snap mode, sidebar state |
| `/api/settings` | PATCH | Update settings |

## Tier 2: Graph Queries

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/canvas/nodes/:id/connections` | GET | Edges + connected nodes for a node |
| `/api/canvas/nodes/:id/hierarchy` | GET | Ancestor/descendant chain via inheritance/implementation |
| `/api/canvas/groups/:id/children` | GET | Nodes contained within a group's bounds |
| `/api/canvas/orphans` | GET | Nodes with no edges |
| `/api/canvas/edges?relationshipType=X` | GET | Filter edges by relationship type (added to existing endpoint) |

## Tier 3: SSE Real-Time Events

`GET /api/events` — Server-Sent Events stream.

Events: `node:created`, `node:updated`, `node:deleted`, `edge:created`, `edge:updated`, `edge:deleted`, `file:switched`, `file:saved`, `file:created`, `file:deleted`, `canvas:undo`, `canvas:redo`.

Architecture: Browser bridge client emits events via Vite HMR WS → server EventEmitter → SSE stream to API clients.

## Tier 4: Export

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/canvas/export?format=json` | GET | Full structured canvas export |
| `/api/canvas/export?format=png` | GET | PNG data URL via html-to-image |
| `/api/canvas/export?format=svg` | GET | SVG string via html-to-image |

## Implementation

### New Files
- `src/server/routes/stats.ts`
- `src/server/routes/settings.ts`
- `src/server/routes/connections.ts`
- `src/server/routes/export.ts`
- `src/server/events.ts`
- `src/server/routes/events.ts`

### Modified Files
- `src/server/routes/files.ts` — add DELETE, PATCH rename, POST refresh
- `src/server/routes/edges.ts` — add batch delete, relationshipType filter
- `src/server/routes/nodes.ts` — add duplicate
- `src/server/app.ts` — register new routes
- `src/server/bridge.ts` — forward events for SSE
- `src/server/plugin.ts` — handle SSE streaming responses
- `src/bridge/client.ts` — all new action handlers
- `schemata-plugin/skills/canvas-api/SKILL.md` — document new endpoints
