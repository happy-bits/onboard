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


1. Start with an empty database except for the Superadmin account. Log in as the Superadmin and create two Leaders. Finally, verify the database (see below).


2. Start with a database containing one Superadmin and one Leader. Log in as the Leader and invite two people. One of them follows the invitation link, creates an account, and sees the onboarding page with the checkboxes. The Member checks the boxes one by one, and the Leader should see the progress update. Finally, verify the database (see below).


Use Playwright for this


### Verify the database


- Create a way to dump the entire database, for example by exporting it to a JSON file that contains all tables and rows.
- After each test, verify the state of the database (for example, that the correct rows and values exist).


All seed data must be identical every time. Do not use random numbers or the current time.


## Docker


Use Docker for the database (Postgres)
