# Install the improved Time Clock

1. Open the Google Apps Script project that powers the current web app.
2. Add or replace the server file with the supplied `Code.gs`.
3. Add an HTML file named `index` and replace its contents with the supplied `index.html`.
4. Save the project, select `setupTimeClock` from the function menu, and click **Run** once.
5. Approve spreadsheet access when Google requests authorization. A successful run returns a message confirming the `Time Clock Log` tab.
6. Choose **Deploy → Manage deployments → Edit**.
7. Select **New version**, set **Execute as** to **Me**, and deploy it to users in `theedladder.org`.

The backend writes to spreadsheet `1Jju4GsByyI1IAzVc-QgMiJCGOuVZEpNecm_ORh9nfWE`. It automatically creates a tab named **Time Clock Log**, adds column headers, and appends one row for every action.

The replacement front end preserves the existing server function names:

- `getStatus`
- `recordCheckIn`
- `recordCheckOut`
- `reportRunningLate`
- `reportUnableToAttend`
- `recordBreakOut`
- `recordBreakIn`
- `recordLunchRetroactive`

The included `Code.gs` provides all of these functions.

Successful actions save quietly and refresh the status without alerts or confirmation messages. Forms appear only when an action requires additional information.

The work-site preference is stored only on the employee's current device. They can choose a site for the day or keep it selected for future visits, and can change that setting from the time-clock screen.
