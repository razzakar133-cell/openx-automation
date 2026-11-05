# OpenX Automation

A phone-first Android prototype built with Vite + Capacitor.

## Features in v1
- Open websites using the device browser
- Google search shortcut
- Local task planner
- Approval/rejection queue
- Local activity history

## Important limitations
This is a prototype, not a full AI or device-wide automation agent.
- Approving a task only marks it approved; it does not execute it.
- It does not read messages, post to social networks, send emails, or control other apps.
- Tasks are stored locally in the app's browser storage and are not cloud-synced.
- Device-wide automation requires a separately implemented Android Accessibility Service and explicit user permission.
- AI requires a separately configured model/provider. No API key is included.

## Build APK using GitHub Actions
1. Create a public GitHub repository named `openx-automation`.
2. Upload all files and folders from this project to the repository root.
3. Commit to the `main` branch.
4. Open the repository's Actions tab.
5. Select `Build OpenX Android APK` and run the workflow (or wait for push build).
6. When complete, open the workflow run and download the `OpenX-Automation-APK` artifact.
7. Extract the ZIP and install `app-debug.apk` on your Android phone.

## Local development
Requires Node.js 20 and Java 17:
```bash
npm install
npm run build
npx cap add android
npx cap sync android
```

## Security
Never commit passwords, access tokens, private API keys, or personal account credentials.
