# N K Hotel OS -- Project Handover (Fresh Chat)

## Current Status

-   Staff Operations Dashboard is live and usable.
-   Manual Quick Action creates AI Tasks.
-   Google Sheets is the source of truth.
-   Timeline, roster, shifts and AI Tasks are operational.
-   Current focus: polish UI, AI Email Reader, Staff Performance.

## Folder Structure

``` text
app/
├── api/
│   ├── tasks/
│   ├── properties/
│   ├── shift/
├── components/
│   ├── dashboard/
│   ├── timeline/
│   ├── quickAction/
│   ├── performance/
│   └── email-reader (planned)
├── hooks/
│   └── useTasks.ts
├── services/
│   └── taskEngine.ts
├── lib/
│   └── api.ts
└── types/
```

## Google Sheets

Current: - AI Tasks - AI Conversations - Team - Properties - Master
Work - Shift Control

Planned: - AI Email Reader - AI Email Rules - AI Email Decisions -
Occupancy Snapshot

## Operations Feed Vision

Single timeline containing: - Pending Tasks - Active Tasks - Completed
Tasks (after previous day 10 PM) - AI Emails - WhatsApp Requests - Phone
Requests - Client Portal Requests - AI Monitor Alerts

## AI Email Reader

Flow:

Gmail → AI Email Reader Sheet → AI Analysis → Timeline Card → Approve /
Edit / Ignore → AI Tasks

Expanded card: - Sender - Subject - Full Body - Attachments - AI
Summary - Suggested Property - Suggested Task - Suggested Priority

Buttons: - Approve - Edit & Approve - Ignore Now - Ignore Permanently
(Master)

## AI Learning

Sheets: - AI Email Rules - AI Email Decisions

Learning actions: - Approve - Edit - Ignore Once - Ignore Permanently

## Staff Performance

Planned: - Weekly score - Task speed - Acceptance time - Completion
time - Productivity - AI coach - Pie charts - Bar charts - Weekly goals

## Hotel Performance

Planned: - Occupancy - Bookings - Response time - Pending tasks - OTA
Health - AI Recommendations - Health Score

## Client Portal Integration

Read-only first:

Client Portal → Occupancy API → Occupancy Snapshot → AI Monitoring

No write-back initially.

## WhatsApp

Always wrap sendAIWhatsApp() in try/catch so failures never stop
shift/task engines.

## Priorities

1.  Stabilize timeline
2.  Staff Performance
3.  AI Email Reader
4.  Occupancy Integration
5.  Guest Reply AI
6.  Hotel Performance
7.  AI Monitor
8.  Owner AI Reports
