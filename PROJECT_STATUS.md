# N K Staff Dashboard - Project Status

*Last Updated: 2026-07-08*

> This document is the **single source of truth** for the project.
> Future ChatGPT conversations should read this file first before making
> recommendations or writing code.

------------------------------------------------------------------------

# Project Overview

**Project:** N K Staff Dashboard / N K Hotel OS Operations Dashboard

**Purpose**

A modular, role-based operations dashboard for N K Hotels that
integrates Google Workspace, Apps Script, AI task generation, WhatsApp
notifications, Gmail parsing, scheduling, and hotel operations into a
single SaaS-style platform.

------------------------------------------------------------------------

# Overall Progress

**Estimated Completion:** **65--70%**

The core architecture is complete. Remaining work is focused on UI
polish, scheduler enhancements, automation, AI monitoring, reporting,
and management modules.

------------------------------------------------------------------------

# Current Architecture

    Google Workspace
    ├── AI Tasks
    ├── Task Scheduler
    ├── Team
    ├── Properties
    ├── Roster

            │

    Apps Script API

            │

    Next.js

            │

    React Hooks
    ├── useAuth
    ├── useShift
    ├── useTasks

            │

    Dashboards
    ├── Master
    ├── Supervisor
    └── Team

------------------------------------------------------------------------

# Current Folder Structure

    app/
    ├── page.tsx
    ├── dashboards/
    ├── components/
    ├── hooks/
    ├── lib/
    ├── api/
    └── types/

------------------------------------------------------------------------

# Completed Modules

-   Authentication
-   Session handling
-   Role-based dashboard routing
-   Team Dashboard
-   Master Dashboard
-   Shift Engine
-   Task Engine
-   Timeline
-   Company Task Center
-   Task Scheduler (foundation)
-   Gmail Parsing Engine
-   WhatsApp AI backend
-   Roster integration

------------------------------------------------------------------------

# Working Features

-   Login / Logout
-   Session restore
-   Shift detection
-   View-only mode outside shifts
-   Live task loading
-   Task filtering
-   Search
-   Timeline
-   Auto refresh
-   Company statistics
-   CEO brief
-   Sidebar navigation
-   AI task integration

------------------------------------------------------------------------

# Pending Features

## High Priority

-   Scheduler polish
-   Property dropdown
-   Staff dropdown
-   Edit/Delete schedules
-   Recurring task engine

## Management

-   Property Center
-   Team Center
-   Reports Center
-   AI Center

## AI

-   Property Monitor
-   Booking Auditor
-   Occupancy Monitor
-   Cancellation Monitor
-   Revenue Alerts

## Dashboard

-   KPI charts
-   Occupancy graphs
-   Live notifications
-   Premium quick actions

------------------------------------------------------------------------

# Current Sprint

## UI Foundation Sprint

Priority:

1.  Global Design System
2.  Light/Dark Theme
3.  Shared UI Components
4.  Dashboard Polish
5.  Scheduler Polish

------------------------------------------------------------------------

# Known Issues

-   Scheduler still contains manual text fields.
-   Property and Staff dropdowns not fully connected.
-   Monitor Company Task Center API stability.
-   Theme engine not implemented.
-   Some placeholder widgets remain.

------------------------------------------------------------------------

# Project Principles

-   Keep files under 250--300 lines.
-   One responsibility per file.
-   Reuse components.
-   Avoid hardcoded values.
-   Preserve functionality during UI improvements.
-   Desktop-first with responsive support.
-   Performance and maintainability first.

------------------------------------------------------------------------

# Next Recommended Task

Complete the UI Foundation Sprint before adding new business modules.

------------------------------------------------------------------------

# Changelog

## 2026-07-08

-   Established modular architecture.
-   Dashboard, task engine, shift engine, scheduler foundation and AI
    integrations in place.
-   Decided to use this Markdown file as the permanent project history
    and status document for future chats.
-   Next milestone: Premium SaaS UI Foundation Sprint.

------------------------------------------------------------------------

# Instructions for Future Chats

1.  Read this document first.
2.  Treat this document as the source of truth.
3.  Preserve the existing architecture.
4.  Recommend the next logical task before coding.
5.  Only modify files relevant to the requested feature.
6.  Provide complete replacement code for changed files.
