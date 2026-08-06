# Story

We start with a blank database, only the table "users" has a row which contains a superadmin account.

A user goes to the login page, and fills in the email "admin@onboard.local" and password "admin123" for the superadmin account, then clicks "Log in". She is presented with a view with the header "Superadmin".

She registers two leaders by entering, for each one, an email and a password into the same email/password fields and clicking "Create": first "leader1@onboard.local" / "leader1pass", then "leader2@onboard.local" / "leader2pass". After each one is created, its email appears in a list of leaders.

Now, the database should contain three users (the superadmin and the two leaders) and two teams (one team per leader, named "Team leader1@onboard.local" and "Team leader2@onboard.local"), no invitations, no onboarding progress, and a single session belonging to the superadmin.
