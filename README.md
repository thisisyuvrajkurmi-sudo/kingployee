# Employee & DRS Manager

Mobile-first attendance and DRS (Delivery Run Sheet) copy manager. Plain HTML, CSS and JavaScript, no build step, installable as a PWA and fully usable offline after the first load.

## What it does
- **Dashboard**: employees, present/absent/leave today, total DRS copies, today's attendance %, recent activity, quick actions. Updates automatically after every change.
- **Employees**: add, edit, search (name or ID), photo, active/inactive, individual profile with attendance history, monthly summary and DRS records. Deleting asks for confirmation and offers **Archive** (keeps all DRS files) or permanent delete (needs the employee ID typed in).
- **Attendance**: Present / Absent / Half Day / Leave / Holiday, check-in/out, remarks, single and bulk marking, monthly calendar, records filter by date range, employee and status. One record per employee per date is enforced by a unique database index.
- **DRS Copy Management**: every employee has a separate folder. Upload PDF/JPG/JPEG/PNG (checked by extension *and* file contents, 25 MB limit), view (PDF/image preview), download, edit, delete with confirmation, search by number, filter by employee/date, grouped-by-employee or master list, CSV export. Duplicate DRS numbers for the same employee are rejected.
- **Reports**: daily, weekly, monthly (all employees), employee-wise, present/absent; DRS summary, employee-wise count, date-wise, searchable history. Each one has CSV export and Print / Save as PDF.
- **Settings**: app and company name, administrator details and password, date format, theme (light / dark navy / device), ZIP backup and restore.

## Important: where your data lives
Everything (employees, attendance, DRS files) is stored in **IndexedDB inside the browser on the device you use**. It is **not uploaded and not synced** between phones or computers. Clearing browser data or uninstalling can erase it. Download a backup from *Settings > Data and backup* regularly. Backups are ZIP files containing `data.json` plus every DRS document in `drs-files/<employee ID>/`. Restoring replaces all data on that device and is all-or-nothing (a damaged or invalid backup is rejected and nothing changes). Moving data to another device = back up on one, restore on the other.

## Login and security
First sign-in: **admin / admin123**. Change it in *Settings > Administrator*.

This login is **frontend-only**. It runs in the browser, so it is **not secure** for a publicly reachable, multi-user business system: anyone with access to the device can read the stored data, and the screen lock can be bypassed with browser tools. Use it for devices you control. To add real security later, replace the body of the `Auth` object in `app.js` (`login`, `logout`, `isLoggedIn`, `changeCredentials`) with calls to your server (session cookie or JWT) and move `db.js` to an API. The rest of the app only talks to `Auth`.

## Project structure
```
index.html            app shell
style.css             styles (light + dark navy themes, print styles)
app.js                UI, views, auth, reports, backup/restore
db.js                 IndexedDB layer
zip.js                dependency-free ZIP writer/reader for backups
manifest.json         PWA manifest
service-worker.js     offline caching (network-first, cache fallback)
vercel.json           headers for Vercel
icons/                192, 512, maskable, apple-touch, favicon
```

## Run locally
Service workers need `http://localhost` or HTTPS (opening `index.html` by double-click will not enable PWA/offline).
```
cd employee-drs-manager
python3 -m http.server 8080      # or: npx serve .
```
Open http://localhost:8080.

## Upload to GitHub (step by step)
1. Create a free account at github.com and click **New repository**. Name it e.g. `employee-drs-manager`, leave it empty (no README), click **Create repository**.
2. **Without Git (easiest):** on the new repo page click **uploading an existing file**. Unzip this project first, open the folder, select **everything inside it** (including the `icons` folder) and drag it into the browser. Click **Commit changes**.
   **With Git:**
   ```
   cd employee-drs-manager
   git init
   git add .
   git commit -m "Employee & DRS Manager"
   git branch -M main
   git remote add origin https://github.com/YOUR-USER/employee-drs-manager.git
   git push -u origin main
   ```
3. Check that `index.html` is at the **top level** of the repo, not inside a sub-folder.

## Deploy on Vercel (step by step)
1. Go to vercel.com and sign up with **Continue with GitHub**.
2. Click **Add New > Project**, then **Import** your `employee-drs-manager` repository (grant access if asked).
3. Leave everything as is: **Framework Preset: Other**, **Build Command: empty**, **Output Directory: empty**, **Root Directory: ./**. Click **Deploy**.
4. After about 30 seconds you get a URL like `https://employee-drs-manager.vercel.app`. Every later push to GitHub redeploys automatically.
5. HTTPS is provided by Vercel, which is required for installing the app and for offline mode.

When you publish an update, the service worker fetches new files whenever the device is online. If you ever need to force-refresh cached files, change `CACHE = 'edm-v1'` in `service-worker.js` to `edm-v2`.

## Install on an Android phone
1. Open the Vercel URL in **Chrome** and sign in once while online (this caches the app).
2. Tap the **⋮** menu > **Install app** (or **Add to Home screen**). An **Install** button also appears in the app's top bar when Chrome allows it.
3. Open it from the new home-screen icon. It runs full screen without browser bars and works with no internet.
4. Remember: data stays on that phone. Use backups to move or protect it.

## Notes
- PDF preview uses the browser's built-in viewer. Some mobile browsers (notably Android Chrome) can't show PDFs inside a page, so the viewer then offers **Open in new tab** and **Download**.
- Attendance % = (present + half-days × 0.5) ÷ working days marked (holidays excluded). On the dashboard it is (present + half day) ÷ active employees.
- Photos are resized to 256 px and stored inside the employee record.
- Tested in headless Chromium (mobile 390 px and desktop): login, employee CRUD and validation, bulk/single attendance, calendar, DRS upload/validation/duplicate/view/download, all reports and CSV, backup, permanent delete, restore, corrupt-file rejection, archive, offline reload, no horizontal overflow.
