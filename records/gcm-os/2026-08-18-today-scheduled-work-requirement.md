# GCM OS — Today / Mission Control Scheduled Work Requirement

**Record Date:** 2026-08-18  
**Area:** Today / Mission Control  
**Status:** Mandatory redesign requirement

## Requirement

The Today / Mission Control page must show all scheduled appointments and operational work sessions for the current day.

This is not optional and is not satisfied by merely linking to the Calendar page.

## Scheduled Items That Must Appear

Examples include:

- Client appointments
- Internal work sessions
- Script review / recording sessions
- Client calls
- Production meetings
- Follow-up sessions
- Media deadlines
- Other scheduled operational commitments

## Monica Script Session Example

The 2026-08-18 Monica Script Session at 9:30 AM exposed the current gap.

The session had active work attached:

- Safe Moving Services 2 — Working Script
- Safe Repair Services 2 — Working Script
- Session goal: review/rewrite in Monica's natural speaking style, approve final wording, then move each to Recording

The event existed in Google Calendar but did not appear on Today / Mission Control because production `today.html` does not currently consume Google Calendar events and `calendar.html` still states that Google Calendar Worker/OAuth integration is not connected to the website.

## Required Today Behavior

For each appointment or session occurring today, Mission Control must display at minimum:

- Time
- Title
- Client / business when applicable
- Type: Appointment / Session / Call / Production / Deadline
- Purpose
- Current work or materials attached to the session
- Next action
- Direct action to open the working material or event

Example:

**9:30 AM — Monica Script Session**  
Safe Moving Services 2 + Safe Repair Services 2  
Next action: Review with Monica → approve wording → Recording  
Action: Open Scripts

## Operating Rule

If work has a scheduled time today, it belongs on Today / Mission Control.

A reminder, Google Calendar event, or calendar record must not exist in a separate silo that Mission Control cannot see.

## Integration Requirement

The redesign must provide one authoritative scheduled-work feed into Today. Google Calendar may be the scheduling source, but the OS must surface those records on Mission Control with enough operating context to act without opening multiple systems.

## Design Principle

Today is the user's operational command center. It must answer both:

1. **What needs attention?**
2. **What am I committed to do today, and when?**

A Today page that omits appointments or scheduled sessions is incomplete.
