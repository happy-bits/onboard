# Story

We start with a database containing a superadmin account and a leader account, "leader@onboard.local" / "leader123", who already leads "Team leader@onboard.local".

The leader goes to the login page, fills in her email and password, and clicks "Log in". She is presented with a view with the header "Team leader@onboard.local".

She invites two people by entering an email and clicking "Invite": first "member1@onboard.local", then "member2@onboard.local". After each invitation, its email appears in a list of invitations. Each invitation sends an email, stored in the database, with a subject and a body containing a unique invite link (e.g. containing "invite-token-1") that is valid for 24 hours.

A separate user opens the dev inbox page, finds the email addressed to "member1@onboard.local" containing "invite-token-1", and follows the link inside it. She is presented with a view with the header "Join Team leader@onboard.local". She fills in a password, "member1pass", and clicks "Create account". She is then presented with a view with the header "Your onboarding", showing a summary that reads "0/3 steps completed".

Meanwhile, on the leader's page, the new member's progress appears showing "0/3", without the leader reloading the page.

The new member checks three checkboxes one by one (step1, then step2, then step3). After each one, the leader's view of that member's progress updates to "1/3", then "2/3", then "3/3", without the leader reloading the page.

Now, the database should contain:
- three users: the superadmin, the leader, and the new member (who belongs to the leader's team);
- one team, "Team leader@onboard.local", led by the leader;
- two invitations for the leader's team: one for "member1@onboard.local" (token "invite-token-1"), which has been used, and one for "member2@onboard.local" (token "invite-token-2"), which has not been used; both created at the same instant and expiring 24 hours later;
- one onboarding progress record for the new member, with all three steps completed;
- two sessions: one for the leader and one for the new member;
- two emails, one to each invited address, each with the subject "You have been invited to onboard" and a body naming the leader, the team, and the invite link, sent at the same instant the invitations were created.
