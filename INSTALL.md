# Install the improved Time Clock

1. Open the Google Apps Script project that powers the current web app.
2. Open its existing HTML file (often named `Index.html`).
3. Replace that file's contents with the supplied `Index.html`.
4. Save, then choose **Deploy → Manage deployments → Edit**.
5. Select **New version**, then deploy.

The replacement front end preserves the existing server function names:

- `getStatus`
- `recordCheckIn`
- `recordCheckOut`
- `reportRunningLate`
- `reportUnableToAttend`
- `recordBreakOut`
- `recordBreakIn`
- `recordLunchRetroactive`

No server-side `.gs` changes are required unless those names differ in the source project.

Successful actions save quietly and refresh the status without alerts or confirmation messages. Forms appear only when an action requires additional information.

The work-site preference is stored only on the employee's current device. They can choose a site for the day or keep it selected for future visits, and can change that setting from the time-clock screen.
