CampUs intro/auth visibility fix (v2)

This folder was rebuilt from the uploaded CampusFind-Frontend(7).zip.
Fixes: removes the CSS rule that always hid #authGate, explicitly toggles its visible/hidden state in app.js, and bumps CSS/JS cache versions.

To check the UI on your Mac:
1. Extract this folder to Downloads.
2. Open Terminal and run: cd ~/Downloads/CampUs-Intro-Auth-Fix-v2
3. Run: python3 -m http.server 8001
4. Open http://localhost:8001
5. On the welcome screen tap “Open CampUs” or “Get started”. The Login/Create Account choices should appear.

Note: Login/registration API calls still require the Spring Boot backend to be running. This static server is only for checking the screen transition.
