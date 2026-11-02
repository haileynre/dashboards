/* Daily change log for the change calendar.
   Add a row when a Cursor session changes something the team should see.
   actualImpact is the result Hailey wrote, including work finished by hand.
   Set needsReview to false and decision to "approved" when an entry is approved.
   Set decision to "rejected" to hide an entry. The page does not render those.
   Leave out work that was stopped or rejected before it landed. */
window.CHANGE_LOG = [
  {
    id: "2026-10-27-merge-drafts",
    date: "2026-10-27",
    platforms: ["n8n"],
    brand: "Gator, TTTC, Zero Down, Deal Scout, Deal Detective",
    status: "draft",
    title: "Merge-leads copies saved for five brands, left off",
    change: "Inactive copies of the Subto merge flow were saved in the HAILEY folder. Each one listens only to that brand’s Close account. SquadUp was skipped because that org has no Merge Request activity. They follow 438a: match primary-contact email, then phone; a checkout or [SP] purchase line wins the lead that is kept; a lead with [SP] or [DTC] in the description is never merged away. Results post to #merge-leads.",
    impacts: "Nothing merged on this day, because the copies were off. Turning them on later means a Sales: Merge Request in that brand can combine two leads. A wrong match would merge two real people. Deal Detective’s Slack line has no brand emoji.",
    needsReview: true,
    links: [
      { label: "438b Gator", href: "https://n8n.newreach.com/workflow/9iiypnQIq3zkGkbU" },
      { label: "438c TTTC", href: "https://n8n.newreach.com/workflow/edGcTEk2HQ1SqsFc" },
      { label: "438d Zero Down", href: "https://n8n.newreach.com/workflow/TrBJCZsGyN6Tsx8X" },
      { label: "438e Deal Scout", href: "https://n8n.newreach.com/workflow/1LsgjeLEJvzbCCeb" },
      { label: "438f Deal Detective", href: "https://n8n.newreach.com/workflow/OUCvOyvi0DYgk1ac" }
    ]
  },
  {
    id: "2026-10-27-ac-forms",
    date: "2026-10-27",
    platforms: ["n8n", "ActiveCampaign"],
    brand: "Subto, Gator, Zero Down, TTTC",
    status: "live",
    title: "Pulse started cloning a paid form and an email form per Live webinar",
    change: "322t. Create Webinar AC Forms was extended and turned on. When a Live webinar is created in Pulse on the support@subto.com Zoom account, 322s still writes the registrant tag and the (Email) tag into that brand’s ActiveCampaign account, then 322t copies both template forms. Subto uses forms 593 and 591, Gator 99 and 101, Zero Down 19 and 18, Top Tier 39 and 37. Titles look like “Subto (PAID: Co-Living Webinar 10/22)”. The template forms themselves are not edited. A form failure does not stop the Zoom webinar, the registry, or the Pulse callback. The thank-you URL stays whatever is baked into the template.",
    impacts: "A new form applies a tag whose name contains Registrant. 232a routes those tags to 323a Webinar Registration Hub, which can create the Close lead and write 01. New Activity when crm writes are on. New forms can still send people to the template thank-you page, including the Co-Living URL on the Subto template. This path was turned off on November 2. Forms created before that stay in ActiveCampaign.",
    needsReview: true,
    links: [
      { label: "322t Create Webinar AC Forms", href: "https://n8n.newreach.com/workflow/yCwGi8x1izSxh7cE" }
    ]
  },
  {
    id: "2026-10-27-nov17-trace",
    date: "2026-10-27",
    platforms: ["Close", "n8n", "ActiveCampaign"],
    brand: "Subto",
    status: "reviewed",
    title: "Checked November 17 Live registrations. No records were edited",
    change: "Of 62 emails on the sheet, 58 already had 01. New Activity on Subto Close with funnel Live Webinar - 11/17/2026. Jacob Lunger’s path was ActiveCampaign tag, then 232a, then 323a, which registered him on the Zoom webinar and wrote the Close activity. The tag name still says November 13. The Close funnel says November 17. Seven leads have two or three copies of that same activity.",
    impacts: "No platform was changed. Listeners on 01. New Activity may already have run once per duplicate. The tag date and the funnel date describe different days, so a report that trusts the tag will not match Close.",
    needsReview: true,
    links: []
  },
  {
    id: "2026-10-28-msa",
    date: "2026-10-28",
    platforms: ["Close", "GitHub Pages"],
    brand: "Subto",
    status: "live",
    title: "1,016 Subto leads moved to four Member Success Advisors",
    change: "The MSA field was round-robined to Shemelia Freeman, Daisha Kincade, Mirisa Robles, and Julia Warmus, 254 leads each. That set is 803 leads still on Chris Burrow or Joe Morales (completed and churned memberships left in place) plus 213 with an empty MSA who were marked Signed Up on or after September 18. Lead owner was not changed. A team page with the counts, and no member names, is on GitHub Pages.",
    impacts: "MSA trackers join on the advisor’s display name, so those books move with this field. Anything else that assigns work from the MSA field now points at the four advisors. Chris Burrow and Joe Morales have no remaining leads in Live, Paused, Potential Churn, or a blank membership status. Their completed and churned leads stayed.",
    needsReview: true,
    links: [
      { label: "Team write-up", href: "https://haileynre.github.io/msa-reassignment/" }
    ]
  },
  {
    id: "2026-10-28-fb-group",
    date: "2026-10-28",
    platforms: ["Close"],
    brand: "Subto",
    status: "live",
    title: "Facebook Group approvals added to a Subto smart view, with SDR owners and New Activity",
    change: "Smart view “FB Group approved Oct 23-28” is shared with the Subto org. Of 170 approved people on the sheet from October 24–28, 123 had a real email or phone. 112 were already in the view. 11 more were added, including 9 new leads. 47 people still have no usable email or phone. 70 leads with an empty SDR Lead Owner were round-robined to Marquis Murriel, Rodrigo Labra, Cathy Mahar, and Chris Burrow. 117 leads received 01. New Activity with lead channel Free Facebook Group, dated the day they first appeared on the sheet. 7 already had that channel and were left alone.",
    impacts: "01. New Activity is a live edge. A new activity can start other automations even though the channel is Free Facebook Group. Filling SDR Lead Owner can start SDR follow-up anywhere that field is watched. The smart view itself does not run an automation. Five older lead ids from the Zapier history no longer exist, so the view shows 124 people while the saved search holds 129 ids.",
    needsReview: true,
    links: [
      { label: "FB Group approved Oct 23-28", href: "https://app.close.com/leads/save_AIK2lVpUTL3XV0Lu6kkiDWXpSZg1eSXXhsdZjpMIcA0/" }
    ]
  },
  {
    id: "2026-10-28-fb-zap-draft",
    date: "2026-10-28",
    platforms: ["Zapier"],
    brand: "Subto",
    status: "draft",
    title: "Private NextGen copy of the Facebook Group zap, find-by-phone, not published",
    change: "The live Zap was imported as a private Zapier workflow named “Subto FFB Leads - find by phone”. Find Lead now searches and creates on phone. A row continues only when the decision says approved and the phone has 10 digits. Placeholder text such as “(given, not captured)” is not sent to Close. The draft was not published, and the missing people were not run through it.",
    impacts: "The live Zap is unchanged, so today’s approvals still follow the old email find. Publishing the draft would start creating Close leads from phone numbers. Most of the missing rows still have no usable phone, so a phone find would not recover them.",
    needsReview: true,
    links: [
      { label: "Private draft", href: "https://zapier.com/workflow/01a1847a-bc3d-765c-b960-b88b75431dfb/draft/1/workflow.ts" }
    ]
  },
  {
    id: "2026-10-28-aletia-update",
    date: "2026-10-28",
    platforms: ["Pulse", "n8n", "Zoom"],
    brand: "Subto",
    status: "reviewed",
    title: "Host and landing page on the Aletia Tomkins event did not change Zoom",
    change: "Pulse saved the edit and sent an updated webhook for Creative Finance Training with Aletia Tomkins (Saturday Nov 7, Zoom meeting 89133592909). 322e handed it to 322m Meeting Ops. Topic, start, and duration already matched, so Zoom was left as it is. The host name was stored on the Pulse mirror. Zoom’s host is still pace@subto.com. The landing-page link was not in the webhook n8n receives.",
    impacts: "No Zoom meeting, registry row, Slack notice, or ActiveCampaign tag was written by this edit. Registrations on that meeting link still do not reach ActiveCampaign or Close. That gap is the October 30 note.",
    needsReview: true,
    links: []
  },
  {
    id: "2026-10-29-oc-fields",
    date: "2026-10-29",
    platforms: ["Close"],
    brand: "Owners Club",
    status: "live",
    title: "Owners Club custom fields and activity types cut down to the keep list",
    change: "Owners Club went from 165 lead fields to 29. 136 fields were deleted. Lead Type stayed, including on 01. New Activity, Deal Won, and Initial Sale Made. Media Release was deleted as a lead field, which also removed it from Contract Signed and Contract Signed - Program Reinstated, and it was copied back onto those two activities only. 26 custom activity types were deleted. 41 types from the keep list remain, including 01. New Activity, the sales and AR activities, Contract Sent, Contract Signed, Deal Won, the DOE activities, and Initial Sale Made.",
    impacts: "Other Close orgs are separate. Subto, Gator, and the rest were not changed. In Owners Club, the values on the deleted fields are gone. A Zap or n8n step that still writes one of those fields or activity types will fail for this account. Media Release is no longer a lead field.",
    needsReview: true,
    links: []
  },
  {
    id: "2026-10-29-merge-on",
    date: "2026-10-29",
    platforms: ["n8n"],
    brand: "All merge brands, plus Owners Club",
    status: "live",
    title: "All seven merge-leads workflows turned on",
    change: "Hailey asked to turn them on. 438a Subto was already on. 438b Gator, 438c TTTC, 438d Zero Down, 438e Deal Scout, 438f Deal Detective, and 438g Owners Club are now on. 438g was added the same day, listens for Sales: Merge Request in Owners Club, and uses the Close - Owners Club credential. Each workflow posts to #merge-leads.",
    impacts: "A Sales: Merge Request in any of these accounts can now merge leads. The same keep rules apply: email, then phone, and a lead marked [SP] or [DTC] is not merged away. A bad match combines two people and the Slack post is the record that it happened.",
    needsReview: true,
    links: []
  },
  {
    id: "2026-10-29-oc-incident",
    date: "2026-10-29",
    platforms: ["n8n", "Close", "monday"],
    brand: "Owners Club",
    status: "live",
    title: "Owners Club incident reports now log to monday",
    change: "Owners Club was already a Brand option on the monday board Comm | Incident Reports. Close Incident Report → monday now listens for a published Community: Incident Report in Owners Club and logs it on that board. Incident Report Form → monday + Close includes Owners Club in the Brand dropdown and writes the activity to the Owners Club account. Both workflows were already on.",
    impacts: "Publishing Community: Incident Report in Owners Club creates a monday item. Submitting the form with Brand set to Owners Club writes that activity into the Owners Club Close account, which can notify anyone listening for it.",
    needsReview: true,
    links: []
  },
  {
    id: "2026-10-29-ebook-tag",
    date: "2026-10-29",
    platforms: ["n8n", "ActiveCampaign"],
    brand: "Subto",
    status: "live",
    title: "Lead magnet intake also applies the a_to_z_ebook tag",
    change: "On Lead Magnet | Webhook Intake, Lead → Add Tag in AC still applies the lead_magnet tag. A second call, Lead → Add Tag a_to_z_ebook, applies a_to_z_ebook when that is a different tag. If lead_magnet is already a_to_z_ebook, the second call is skipped so a duplicate tag does not stop the SMS and Close steps. The change is published.",
    impacts: "The next intake whose magnet tag is something else will also receive a_to_z_ebook. ActiveCampaign tag names wake automations. Anyone listening for a_to_z_ebook will now see those contacts. Herman Woods on the reported execution already had the tag, because lead_magnet was that value.",
    needsReview: true,
    links: [
      { label: "Lead Magnet | Webhook Intake", href: "https://n8n.newreach.com/workflow/SW8OzmTQtIZtKwkB" }
    ]
  },
  {
    id: "2026-10-30-aletia-tags",
    date: "2026-10-30",
    platforms: ["ActiveCampaign"],
    brand: "Subto",
    status: "live",
    title: "Two Subto tags created for the November 7 Aletia Tomkins webinar",
    change: "Tags were created in the Subto ActiveCampaign account for Creative Finance Training with Aletia Tomkins. Neither existed yet. Pulse already had the registrant tag name, so that field was left as it was. A separate request to create Gator tags was withdrawn before any Gator tag was created.",
    impacts: "Creating a tag does not enroll anyone. If a form or Zoom registration applies “11/07/2026 Subto Creative Finance Live Registrant”, 232a will treat it as a registrant tag and can send the person through 323a into Close. The Zoom link for this event is a meeting, so registrations there still do not apply the tag. That is the next note.",
    needsReview: true,
    links: []
  },
  {
    id: "2026-10-30-meeting-gap",
    date: "2026-10-30",
    platforms: ["Zoom", "n8n", "ActiveCampaign", "Close"],
    brand: "Subto",
    status: "reviewed",
    title: "November 7 Aletia registrations on the Zoom meeting link never reach ActiveCampaign or Close",
    change: "No workflow was changed. The registration link is a Zoom meeting (89133592909). The registrant webhook 323e only accepts webinar.registration_created, then looks the id up in scheduled_events. That meeting id is not in the table. 322m creates the Zoom meeting and does not insert a registry row. Close only starts after the ActiveCampaign tag. People who already registered on the meeting link are not in ActiveCampaign. A one-time backfill was not run.",
    impacts: "Those registrants are missing from ActiveCampaign and from Close, so they will not get the registrant tag, 01. New Activity, or anything downstream of either. The Subto form is a separate door: submitting it does create the contact and apply the tag. Turning the event into a Zoom webinar, matching the Nov 4 and Nov 10 Creative Finance events, would put new registrations on the existing path and would change the registration URL.",
    needsReview: true,
    links: []
  },
  {
    id: "2026-10-30-oc-rsvp",
    date: "2026-10-30",
    platforms: ["Eventpack"],
    brand: "Owners Club",
    status: "live",
    title: "Owners Club First 50 registration page is live",
    change: "A public Eventpack registration was published for the first 50 Owners Club members who paid in full. Each person picks one free RSVP, capped at 50, and answers Are you coming? with Yes or No. The form asks for first name, last name, and email. The outing is Sunday, December 6, 2026, 2:00 PM to about 8:00 PM Phoenix time, pickup at the JW Marriott Phoenix Desert Ridge. The event date had been November 12–26. The member list was not loaded, and invitations were not sent.",
    impacts: "Anyone with the link can take a seat until 50 RSVPs are in. It is not limited to those 50 members. The date change means anything still pointing at November 12–26 is describing the old hold.",
    needsReview: true,
    links: [
      { label: "OC First 50 registration", href: "https://registration.eventpack.com/oc-first-50-dec26" }
    ]
  },
  {
    id: "2026-11-02-322t-off",
    date: "2026-11-02",
    platforms: ["n8n", "ActiveCampaign"],
    brand: "Subto, Gator, Zero Down, TTTC",
    status: "live",
    title: "Pulse no longer creates ActiveCampaign forms",
    change: "322t. Create Webinar AC Forms was unpublished. When a webinar setup would have called it, that step is skipped and the rest of Pulse setup continues, including the registrant tags from 322s. Forms already created are still in ActiveCampaign.",
    impacts: "New Live webinars will not get a fresh paid form and email form. Landing pages that expected a new form per event will not receive one. Tag routing through 232a is unchanged, so a ClickFunnels or Zoom registration that applies the registrant tag can still reach Close. Replacing the per-webinar form with a ClickFunnels tag was discussed and not built.",
    needsReview: true,
    links: [
      { label: "322t Create Webinar AC Forms", href: "https://n8n.newreach.com/workflow/yCwGi8x1izSxh7cE" }
    ]
  },
  {
    id: "2026-11-02-form-611",
    date: "2026-11-02",
    platforms: ["ActiveCampaign", "n8n"],
    brand: "Subto",
    status: "reviewed",
    title: "Form 611 submissions since October 30 were exported locally. No contacts were edited",
    change: "Form 611 is Subto Impact Affiliate Performance (PAID: CF Webinar 10/27). From Friday October 30 through the morning of November 2, 270 contacts first received that form’s registrant tag. Two of those rows are internal tests. The list was saved as a local CSV. n8n did not apply “10/27/2026 Subto Creative Finance Live Registrant” to anyone on October 28 or later. That Zoom-webinar tag log stops at 7:24 PM Pacific on October 27. Later people got the tag from the form.",
    impacts: "Nothing was written back to ActiveCampaign, Close, or n8n. The CSV is a local copy of names and emails. It is not a shared sheet.",
    needsReview: true,
    links: []
  },
  {
    id: "2026-11-02-ama-templates",
    date: "2026-11-02",
    platforms: ["Zoom"],
    brand: "Subto, Gator, Zero Down, TTTC",
    status: "reviewed",
    title: "Upcoming AMAs on ama@pacemorby.com share one generic Zoom setup",
    change: "No meeting was edited. Zoom’s app credential can read meetings and cannot list meeting templates (missing meeting:read:list_templates). Eight upcoming meetings, created October 27 and October 29, all use the same settings. The eight October meetings still on the account, created in September, still differ by brand: registration contacts include support@zerodownbusinesses.com, support@subto.com, support@toptiertc.com, and the Gator host. None of the upcoming meetings store a template id. There is no Subto or Top Tier TC meeting in that upcoming set.",
    impacts: "Registrants on the upcoming AMAs get one generic confirmation and registration setup, including meetings titled for Zero Down, Gator, and DOE. Brand-specific questions, contacts, and reminders from the October pattern are not on those meetings until someone applies the matching template.",
    needsReview: true,
    links: []
  },
  {
    id: "2026-11-02-calendar",
    date: "2026-11-02",
    platforms: ["Dashboards"],
    brand: "Internal",
    status: "repo",
    title: "This change calendar was added to the dashboards folder",
    change: "A static page in dashboards/change-calendar logs Cursor changes from October 27 through November 2. It is opened from index.html. It is not published to GitHub Pages.",
    impacts: "No live platform reads this page. It does not trigger Close, n8n, Zapier, or ActiveCampaign.",
    needsReview: true,
    links: []
  }
];
