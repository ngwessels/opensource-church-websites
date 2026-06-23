import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  isExternalCalendarInvite,
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
});
