import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  isExternalCalendarInvite,
  parseCalendarTimezone,
  parseMailtoEmail,
  parseVevents,
  veventToCalendarEvent,
} from "./ical.js";

const CALENDAR_ID = "churchsecretary@vcsknights.org";

const nativeEvent = `
BEGIN:VEVENT
DTSTART:20260607T173000Z
DTEND:20260607T183000Z
UID:5fil3c78k3e9fjh8eolioedpo7@google.com
SUMMARY:8th Grade Graduation
STATUS:CONFIRMED
END:VEVENT`;

const spamInvite = `
BEGIN:VEVENT
DTSTART:20260623T043605Z
ORGANIZER;CN=spam@winintx.com:mailto:spam@winintx.com
UID:zNz5EefUQM@google.com
ATTENDEE;CUTYPE=INDIVIDUAL;ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;CN=churchsecretary@vcsknights.org:mailto:churchsecretary@vcsknights.org
SUMMARY:Reminder: Renew Your Malwarebytes Protection
DESCRIPTION:Fake renewal notice
STATUS:CONFIRMED
END:VEVENT`;

describe("calendar/ical invite filtering", () => {
  it("parses mailto organizer emails", () => {
    assert.equal(parseMailtoEmail("mailto:spam@winintx.com"), "spam@winintx.com");
    assert.equal(parseMailtoEmail("churchsecretary@vcsknights.org"), "churchsecretary@vcsknights.org");
  });

  it("flags external organizers as invites", () => {
    const [spam] = parseVevents(spamInvite);
    const [native] = parseVevents(nativeEvent);

    assert.equal(isExternalCalendarInvite(spam, CALENDAR_ID), true);
    assert.equal(isExternalCalendarInvite(native, CALENDAR_ID), false);
  });

  it("keeps events organized by the calendar owner", () => {
    const ownedInvite = `
BEGIN:VEVENT
DTSTART:20260607T173000Z
ORGANIZER:mailto:churchsecretary@vcsknights.org
SUMMARY:Parish meeting
END:VEVENT`;
    const [event] = parseVevents(ownedInvite);
    assert.equal(isExternalCalendarInvite(event, CALENDAR_ID), false);
  });

  it("converts native events and skips spam invites in a mixed feed", () => {
    const ics = `BEGIN:VCALENDAR\n${nativeEvent}\n${spamInvite}\nEND:VCALENDAR`;
    const vevents = parseVevents(ics).filter((vevent) => !isExternalCalendarInvite(vevent, CALENDAR_ID));
    const events = vevents.map((vevent) => veventToCalendarEvent(vevent)).filter(Boolean);

    assert.equal(vevents.length, 1);
    assert.equal(events[0]?.title, "8th Grade Graduation");
  });

  it("converts UTC instants using X-WR-TIMEZONE instead of server local time", () => {
    const ics = `BEGIN:VCALENDAR
X-WR-TIMEZONE:America/Los_Angeles
BEGIN:VEVENT
DTSTART:20250701T160000Z
DTEND:20250701T170000Z
SUMMARY:Morning Mass
END:VEVENT
BEGIN:VEVENT
DTSTART:20240919T010000Z
DTEND:20240919T013000Z
SUMMARY:Evening meeting
END:VEVENT
END:VCALENDAR`;

    assert.equal(parseCalendarTimezone(ics), "America/Los_Angeles");

    const timezone = parseCalendarTimezone(ics);
    const events = parseVevents(ics)
      .map((vevent) => veventToCalendarEvent(vevent, null, timezone))
      .filter(Boolean);

    assert.equal(events[0]?.date, "2025-07-01");
    assert.equal(events[0]?.startTime, "09:00");
    assert.equal(events[0]?.endTime, "10:00");

    assert.equal(events[1]?.date, "2024-09-18");
    assert.equal(events[1]?.startTime, "18:00");
    assert.equal(events[1]?.endTime, "18:30");
  });

  it("uses site timezone over ICS X-WR-TIMEZONE when both differ", () => {
    const ics = `BEGIN:VCALENDAR
X-WR-TIMEZONE:America/Los_Angeles
BEGIN:VEVENT
DTSTART:20250701T160000Z
DTEND:20250701T170000Z
SUMMARY:Morning Mass
END:VEVENT
END:VCALENDAR`;

    const [vevent] = parseVevents(ics);
    const pacificEvent = veventToCalendarEvent(vevent, null, "America/Los_Angeles");
    const easternEvent = veventToCalendarEvent(vevent, null, "America/New_York");

    assert.equal(pacificEvent?.startTime, "09:00");
    assert.equal(easternEvent?.startTime, "12:00");
  });
});
