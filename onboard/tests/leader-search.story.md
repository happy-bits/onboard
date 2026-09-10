# Story

We start with a blank database, only the table "users" has a row which contains a superadmin account.

A user goes to the login page, and fills in the email "admin@onboard.local" and password "admin123" for the superadmin account, then clicks "Log in". She is presented with a view with the header "Superadmin".

She registers three leaders by entering, for each one, an email and a password into the same email/password fields and clicking "Create": "alice@onboard.local" / "alicepass", "bob@onboard.local" / "bobpass", and "carol@onboard.local" / "carolpass". After each one is created, its email appears in a list of leaders. All three are listed.

Above the list there is a search field. She types "bob" into it, and the list immediately narrows to just "bob@onboard.local" — Alice and Carol are gone.

She clicks "Clear" next to the search field. The field empties and all three leaders are listed again.

She types "nobody" into the search field. Nothing matches, so the list is replaced by a message telling her that no leaders match her search.
