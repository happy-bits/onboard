# Implementation Plan

| ID | Description | Estimation |
|----|-------------|------------|
| S1 | Scaffold the `onboard` web project in the `onboard` folder, with a Docker Compose setup for Postgres and environment configuration for the database connection. | 8 |
| S2 | Define the database schema (users with roles Superadmin/Leader/Member, teams, invitations, onboarding progress) plus migrations and a deterministic seed that creates only the Superadmin with fixed IDs, timestamps and credentials. | 12 |
| S3 | Implement authentication (login, logout, sessions) and role-based access control so every page requires a logged-in user with the right role. | 14 |
| S4 | Build the Superadmin UI and endpoints for listing, creating and removing Leaders, creating each Leader's single team at the same time. | 10 |
| S5 | Implement a fake email service that records sent emails (e.g. in a database table or outbox file), and build the Leader invite flow that generates an invitation link and "sends" it to the entered email address. | 14 |
| S6 | Build the invitation acceptance flow where a Member opens the link, creates an account and joins the Leader's team, then implement the Member onboarding page with three hardcoded checkboxes that save progress. | 16 |
| S7 | Build the Leader team view showing each Member's onboarding progress (not started, in progress, completed) based on the checked boxes. | 8 |
| S8 | Add a database dump-to-JSON tool and database reset/seed helpers, then write the two happy-path Playwright end-to-end tests (Superadmin creates two Leaders; Leader invites two people and a Member completes onboarding while the Leader sees progress) that verify the database state after each test. | 18 |
