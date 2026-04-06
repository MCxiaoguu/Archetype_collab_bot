---
name: uat-testing
description: >
  Use when running UAT tests against the Archetype frontend. Provides test credentials,
  login instructions, and the correct prototype URL for the dev server. Always invoke
  this skill before creating or running UAT tests.
user-invocable: false
---

# UAT Testing — Archetype Dev Server

## Test Credentials

When creating or running UAT tests against the Archetype frontend, ALWAYS use these credentials:

- **Email**: `demo@syntheticarchetype.com`
- **Password**: `DEMO-archetype`

Pass these via the `credentials` parameter when calling `create_uat_test` or `run_uat_test`:

```json
{
  "credentials": {
    "email": "demo@syntheticarchetype.com",
    "password": "DEMO-archetype"
  }
}
```

## Prototype URL

The dev server runs at: `https://dev.syntheticarchetype.com`

Always use this as the `prototypeUrl` when creating tests.

## Login Flow

The app uses Auth0 for authentication. The login flow is:

1. User lands on the homepage
2. Click "Login" or "Sign In" button
3. Auth0 login page appears
4. Enter email: `demo@syntheticarchetype.com`
5. Enter password: `DEMO-archetype`
6. Click "Continue" or "Log In"
7. Redirected back to the app, now authenticated

## Writing Test Cases That Require Auth

For any test case that requires being logged in, the FIRST steps should always be:

```json
{
  "steps": [
    "Navigate to the login page or click the Login button",
    "Enter email demo@syntheticarchetype.com in the email field",
    "Enter password DEMO-archetype in the password field",
    "Click the Continue or Log In button",
    "Wait for redirect back to the application",
    "... (actual test steps follow)"
  ]
}
```

Do NOT use placeholder tokens like `[session_email]`. Use the actual credentials directly in step descriptions so the Notte browser agent knows exactly what to type.

## Common Test Areas

- **Dashboard** — after login, verify dashboard loads with user data
- **Persona Generation** — create/view personas
- **UAT Test Creation** — create and run tests from the UI
- **Feature Management** — CRUD features
- **Workspace** — workspace navigation and settings
