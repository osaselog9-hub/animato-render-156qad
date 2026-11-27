# Video builds for Animato Stickman Studio

This public repo was made by Animato Stickman Studio in your own GitHub account. When you choose **Render on GitHub** in the app,
the app puts your video job on a temporary branch, starts the **render** workflow here, and downloads the finished MP4 when it is ready.

- Everything private (your script, voiceover, and the video itself) is **encrypted** before it is put here; only your phone and the render can read it.
- Your video is kept as a workflow artifact for **one day** and is removed as soon as the app has downloaded it.
- The job branch (job-...) is deleted after the download.
- The workflow only runs when you start a render in the app. There is no schedule.
- The app limits you to ten renders a day, at most 12 pieces drawn at once, and waits between renders, so the account is never loaded heavily.

You can delete this repo at any time. The app makes a new one the next time you use **Render on GitHub**.
