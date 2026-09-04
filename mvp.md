# Onboarding Project – MVP


Create a web project called `onboard` in a folder named `onboard`.


The project should have three user types:
- Superadmin
- Leader
- Member


All users must log in to use the system.


The Superadmin can create and remove Leaders.


Leaders can invite Members. The Leader enters an email address, and an invitation is sent to the Member. If the Member follows the link in the email, they can create an account and will then belong to the Leader's team. For now, a Leader can have only one team.


When the Member is logged in, they can go through an onboarding process. For now, it consists of three hardcoded checkboxes. Once the Member has started or completed the onboarding (by checking the checkboxes), the Leader can view their progress.


## Email


Start by faking an email service. We will replace it with a real one later.


## Database


The database starts empty except for a Superadmin user.


## Testing


Do not create any unit tests. Only create the following happy-path end-to-end tests:


1. **Superadmin can create leaders in an empty system.** Start with an empty database except for the Superadmin account. Log in as the Superadmin and create two Leaders. Finally, verify the database (see below).


2. **A leader invites a member and sees their progress.** Start with a database containing one Superadmin and one Leader. Log in as the Leader and invite two people. One of them follows the invitation link, creates an account, and sees the onboarding page with the checkboxes. The Member checks the boxes one by one, and the Leader should see the progress update. Finally, verify the database (see below).


3. **A leader with a member is deleted.** Start with a database containing one Superadmin and two Leaders, where one Leader has a team with one Member who has completed one checkbox. Log in as the Superadmin and remove that Leader. Finally, verify the database: the Leader row is gone, and the team, Member, and progress rows are in the expected state (decide and document whether they are cascade-deleted or kept).


4. **Onboarding progress is stored in the database.** Start with a database containing one Superadmin, one Leader, and one Member who has checked two of the three boxes. Log in as the Member, verify the two boxes render as checked, check the third, log out, and log in again. All three boxes must still be checked. Finally, verify the database: exactly three progress rows, no duplicates.


5. **An invite link can only be used once.** Start with a database containing one Superadmin, one Leader, and one pending invitation. Follow the invitation link, create an account, and land on the onboarding page. Then visit the same link again — it must not create a second account (the user is redirected to login or told the invitation is already used). Finally, verify the database: exactly one Member and the invitation marked as accepted.


Use Playwright for this


### Verify the database


- Create a way to dump the entire database, for example by exporting it to a JSON file that contains all tables and rows.
- After each test, verify the state of the database (for example, that the correct rows and values exist).


All seed data must be identical every time. Do not use random numbers or the current time.


## Docker


Use Docker for the database (Postgres)

## Implementation notes

Guidance for whoever implements this, based on where time was actually lost last time.

- **Claim unique Docker names and ports before writing the compose file.** Set an explicit compose `name:`, a distinct `container_name:`, and a non-default host port, and check what is already taken (`docker ps -a`, and try to bind the port) before the first `up` — leftover stacks from earlier attempts in the same directory silently collide on all three, and each collision costs a failed start plus an edit.
- **Keep the injectable clock out of anything a browser or external client judges for itself.**
A fixed test clock set in the past will produce absolute deadlines (cookie `Expires`, cache headers, `Retry-After`) that the recipient considers already expired and silently discards, so express client-facing lifetimes relatively (`Max-Age`) and keep clock-derived absolute times on the server side.
- **Make self-generating snapshots fail at least once before you trust them.** A dump/snapshot assertion that writes the expected file when it is missing passes trivially on its first run, so re-run the suite a second time to prove the comparison is real, and read the generated file once to confirm it encodes the right *content* and not merely stable output.
- **Run the project's real build once the first end-to-end slice exists, before driving anything through a browser.** Frameworks enforce rules a type-checker knows nothing about, and a module that violates one fails at compile time in a way that reaches the test as an unrelated timeout on some element that never rendered — so a build that names the offending file in seconds is worth far more than the minutes spent reading a stack trace that points at the wrong layer.
