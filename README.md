# 🎓 CampUs — All-in-One Campus Community & Lost & Found Hub

<div align="center">

![Java](https://img.shields.io/badge/Java-17-ED8B00?style=for-the-badge&logo=openjdk&logoColor=white)
![Spring Boot](https://img.shields.io/badge/Spring_Boot-3.4.3-6DB33F?style=for-the-badge&logo=springboot&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-316192?style=for-the-badge&logo=postgresql&logoColor=white)
![Railway](https://img.shields.io/badge/Railway-Deployment-0B0D0E?style=for-the-badge&logo=railway&logoColor=white)
![Cloudflare Pages](https://img.shields.io/badge/Cloudflare_Pages-Edge_Proxy-F38020?style=for-the-badge&logo=cloudflare&logoColor=white)
![PWA](https://img.shields.io/badge/PWA-Ready-5A0FC8?style=for-the-badge&logo=pwa&logoColor=white)

**One Campus. One Community.**  
*A modern, full-stack campus platform connecting students across universities for Lost & Found recoveries, peer-to-peer student marketplace, real-time community chat, and karma-based reputation leaderboards.*

[Key Features](#-key-features) • [Tech Stack](#-tech-stack) • [Quick Start](#-quick-start) • [Configuration](#-configuration--environment-variables) • [Deployment](#-deployment-guide) • [API Reference](#-api-endpoints-reference)

---

</div>

## 📖 Table of Contents
- [About CampUs](#-about-campus)
- [Key Features](#-key-features)
  - [1. Lost & Found Management](#1-lost--found-management)
  - [2. Verification & Claim Workflow](#2-verification--claim-workflow)
  - [3. Peer-to-Peer Student Marketplace](#3-peer-to-peer-student-marketplace)
  - [4. Real-time Campus Community Chat](#4-real-time-campus-community-chat)
  - [5. Karma Leaderboard & Gamification](#5-karma-leaderboard--gamification)
  - [6. Authentication, Security & OTP Recovery](#6-authentication-security--otp-recovery)
  - [7. Admin Moderation Suite](#7-admin-moderation-suite)
  - [8. Premium UI/UX & Native Mobile Feel](#8-premium-uiux--native-mobile-feel)
- [Architecture & Tech Stack](#-architecture--tech-stack)
- [Project Directory Structure](#-project-directory-structure)
- [Quick Start (Local Development)](#-quick-start)
- [Configuration & Environment Variables](#-configuration--environment-variables)
- [Deployment Guide](#-deployment-guide)
  - [Deploying Backend to Railway (PostgreSQL)](#deploying-backend-to-railway)
  - [Deploying Frontend to Cloudflare Pages](#deploying-frontend-to-cloudflare-pages)
  - [Running with Docker](#running-with-docker)
- [REST API Endpoints Reference](#-api-endpoints-reference)
- [Security & Best Practices](#-security--best-practices)
- [Troubleshooting & FAQ](#-troubleshooting--faq)
- [Authors & License](#-authors--license)

---

## 🌟 About CampUs

In large university campuses, thousands of valuable personal items (student IDs, laptops, keys, calculators, earbuds, jackets) are misplaced daily. Existing solutions rely on fragmented WhatsApp groups, Facebook posts, or physical noticeboards where inquiries quickly get lost in the noise.

**CampUs** solves this by centralizing student interactions into a single, high-performance web platform tailored for university ecosystems:
- **Instant Lost & Found reporting** with image compression and category tags.
- **Fraud-resistant claim verification** using custom security questions and image proof.
- **Direct Student Marketplace** for affordable on-campus textbooks, electronics, and supplies.
- **Community Chat & Karma Rewards** to incentivize good deeds and build genuine campus connections.

---

## 🚀 Key Features

### 1. Lost & Found Management
- **Categorized Listings**: Filter by Category (Electronics, ID & Cards, Books, Bags, Accessories, Keys, etc.), Location, and Status (*Open*, *Matched*, *Returned*).
- **Client-Side Image Compression**: Automatically compresses uploaded photos using HTML5 Canvas before sending, saving bandwidth and storage.
- **Smart Search & Filters**: Live, instantaneous search by title, description, or campus building.
- **Detailed Modal Views**: High-resolution image lightbox, author details, contact access, and action buttons.

### 2. Verification & Claim Workflow
- **Anti-Fraud Security Question**: Finders can attach a secret verification question (e.g., *"What is written on the keychain?"* or *"What is the phone wallpaper?"*).
- **Claim Submission**: Claimants must submit an answer and optional verification photo.
- **Claim Management**: Item finders can view all incoming claims, review submitted evidence, and approve or reject claims with one click.
- **Cascade Cleanup**: Deleting or resolving an item safely cascades and updates associated claim records.

### 3. Peer-to-Peer Student Marketplace
- **Campus-Only Listings**: Sell or buy secondhand textbooks, bicycles, calculators, lab coats, hostel accessories, and gadgets.
- **Structured Pricing**: List items with price, condition (New, Like New, Good, Fair), description, and seller contact.
- **Contact Action**: One-tap direct call or WhatsApp connection with sellers.

### 4. Real-time Campus Community Chat
- **Instagram Web DM Floating Message Actions**:
  - **Others' Messages**: Clean bubble with floating action bar on hover showing **React (`☺`)** and **Reply (`↩`)** (no 3-dots).
  - **Own Messages**: Floating action bar on hover showing **More (`⋮`)**, **Reply (`↩`)**, and **React (`☺`)**.
  - **More (`⋮`) Popover**: One-click menu offering **Delete (`🗑️`)** (with instant confirmation) and **Copy (`📋`)** (copies message text to clipboard with instant toast).
  - **Instagram Unsend Confirmation Dialog**: Deleting a message presents the exact Instagram DM prompt:
    > **Unsend message?**  
    > *This will remove the message for everyone but people may have seen it already. Unsent messages may still be included if the conversation is reported.*  
    > **Unsend** (destructively unsends message) • **Cancel** (dismisses prompt).
  - **Emoji Reaction Bar (`☺`) (Zero Clipping)**: Floating popover featuring popular emojis (`❤️`, `😂`, `😮`, `😢`, `👏`, `🔥`, `👍`). Mounted to the root viewport and strictly clamped horizontally (`12px` padding) with `flex-shrink: 0`, preventing any clipping or cut-off emojis. Selecting an emoji attaches a persistent reaction badge to the bubble's bottom corner (clicking again toggles it off).
- **Mobile Touch Gesture (Swipe to Reply)**: On touch devices, swiping a message row activates reply mode with a snappy translation animation.
- **Instagram-Style 2-Line Bottom Reply Bar**:
  - Line 1: `Replying to <username>`
  - Line 2: Message snippet preview
  - Right: `✕` dismiss button that instantly clears reply state.
- **Instant Mute/Unmute Toggle**: Crisp notification toggle button pinned to the far right corner of the chat header; toggles instantly between Muted (`🔕`) and Unmuted (`🔔`), with custom SVG bell/bell-off icons, toast confirmation, and persistent localStorage sync.
- **Pure Navigation Drawer View & Morphing 2-Line/X Button**: Opening the 2-line animated menu locks the button at the top-right corner where it smoothly morphs into an `✕` in place; clicking it again (or tapping the backdrop) morphs it back into 2 lines. All top header elements (CampUs brand logo, college badge, search bar, greeting) are cleanly hidden when open, with zero backdrop blur (`backdrop-filter: none`).
- **Decluttered Home Header**: Removed the redundant dark/light mode toggle button from the home topbar (theme switching remains conveniently accessible inside the drawer menu).
- **Next Line on Return Key (Send via Button Only)**: Pressing Enter/Return key in the chat textarea inserts a newline for multi-line formatting. Sending happens strictly on clicking the **Send** button.
- **100% Full-Screen on Laptop & Desktop**: Community chat expands to a spacious, immersive 100% full-screen view (`100vw`, `100dvh`) on laptops and tablets, with edge-to-edge responsiveness.
- **Pinned Far-Right Notification Bell**: Notification alert toggle icon is firmly pinned to the far right corner (`right: 18px; top: 50%; transform: translateY(-50%)`) of the chat header with reserved safe padding.
- **Snappy, Lag-Free Button Response**: Zero mobile 300ms delay with `touch-action: manipulation`, `-webkit-tap-highlight-color: transparent`, and instant 0.04s tactile `:active` state across all app buttons.
- **Author Message Deletion**: Senders have full authority to delete their own messages anytime without time limits; administrators and owners can moderate all chat messages.
- **Instant Reply Preview Dismissal**: Dismissing a reply quote with the interactive `X` cancel button immediately clears the quoted message preview.
- **Sub-Second Polling & Cold-Start Protection**: Responsive, lightweight chat with auto-retry and message synchronization that survives transient backend wakes.
- **Swipe-to-Reply & Tap-to-Reply**: Touch and trackpad gesture support to quote messages directly with inline SVG reply indicators and dismissible floating preview.
- **Role Badges**: Highlights verified community roles: `Owner`, `Admin`, `Leader`, `Moderator`, and `Member`.
- **Custom Avatar Suite**: Pick from 30+ custom high-resolution illustrations.

### 5. Karma Leaderboard & Gamification
- **Karma Points**: Students earn reputation points by returning found items, successfully resolving claims, and assisting peers (+50 for returns, +20 for verified claims).
- **Bespoke Vector Medals & Trophies**: Replaced raw emoji icons with custom SVG Gold, Silver, and Bronze medals, vector trophy hero graphics, and golden star point badges.
- **Public Profiles**: Showcase badges, solved returns, active listings, and community tenure.

### 6. Authentication, Security & OTP Recovery
- **Multi-Campus Support**: Select universities (Chandigarh University, CGC Landran, LPU, etc.) with custom courses.
- **Flexible Login**: Sign in via **Username** OR **Email**.
- **Cryptographic Password Security**: Hashed with PBKDF2 using unique per-user salts.
- **Email OTP Recovery**: 6-digit password reset OTP sent via Brevo HTTPS API with automated SMTP fallback.
- **Session Protection**: Cross-origin HTTPS-ready session cookies (`SameSite=None`, `Secure`, `HttpOnly`) and token exchange filter.

### 7. Admin Moderation Suite
- **Role Management**: Promote or demote users across roles (`MEMBER`, `MODERATOR`, `LEADER`, `ADMIN`, `OWNER`).
- **User Sanctions**: Instant ban/unban controls to prevent abuse.
- **Audit Logging**: Every sensitive admin action is logged with IP, timestamp, and operator username.
- **Campus-Wide Announcements**: Broadcast pinned urgent alerts and notices across all screens.

### 8. Native SVG Iconography & Mobile-First UI/UX
- **Custom Vector SVG Icon System**: Completely replaced raw system emojis with a crisp, accessible, hand-crafted SVG iconography system across:
  - Header & desktop navigation (Home, Community Chat, Plus Report Item, Sun/Moon theme toggle).
  - Mobile bottom navigation (Feed, Chat, Plus Create CTA, Search, Profile).
  - Campus main switcher (Lost & Found 3D Box, Campus Market Shopping Bag).
  - Marketplace category slider chips (Books, Drafters, Cycles, Hostel, Electronics, Clothing, Free Giveaways).
  - Instagram-style Explore Search bar, Clear Cross, and Category filters.
  - Activity Center actions (Unarchive, Move to Trash, Delete Forever, View Post, Share).
  - Karma Leaderboard medals (Gold 1st, Silver 2nd, Bronze 3rd) and star badges.
- **2-Line Animated Morphing Navigation Drawer**:
  - *Morphing 2-Line / X Button*: Tapping the 2-line menu button smoothly rotates and morphs the bars into a clean `✕` (cross). Closing the drawer via the `✕` button, clicking the backdrop, navigating, or performing a trackpad swipe-back animates the `✕` seamlessly back into the 2 lines.
  - *Mobile Devices*: Opens full-screen sliding smoothly from right to left (`transform: translateX(100%)` to `0`), matching Instagram's settings drawer with native gesture feel.
  - *Laptops & Desktops*: Opens as a sleek, non-intrusive 380px right-side flyout drawer panel with backdrop blur and fluid animation.
- **Dedicated Auth Viewport**: On login and create account screens, the bottom mobile app navigation bar is completely hidden to provide a focused, distraction-free authentication experience.
- **Protected Post Deletion Permissions**: To maintain public feed integrity and prevent accidental deletions, feed post cards no longer display a delete button. Creators can securely delete their posts exclusively from their own Profile or Activity Center.
- **Universal Uncut Toast Notifications**: Floating snackbars and toast notifications (such as *"Light mode enabled ☀️"*) are centered with dynamic viewport bounds, word-wrap protection, safe-area offsets, and elevated z-index, ensuring notifications are never cut off by screen boundaries or bottom navigation bars.
- **In-Place Animated 2-Line / ✕ Menu Toggle & Hierarchical Return Navigation**: Morphing hamburger button locked rigidly to the top-right corner that transforms smoothly into an `✕` upon drawer opening and returns back to 2 lines when closed or swiped. Background overlay opens clean and crisp without backdrop blur. Navigating to any option from the drawer (Your Activity, Notification & Privacy, Terms & Conditions, Help & Support, Karma Leaderboard, About CampUs, Admin Dashboard, My Reports) preserves the drawer in navigation history, seamlessly returning users back to the drawer when tapping Back (`<`), swiping back with trackpad, or using browser Back.
- **Instagram DM & WhatsApp-Style Community Chat with Rich Reactions**:
  - *Reaction Badges on Messages*: Aggregated emoji badges (e.g. `❤️ ☕ 💋 17` or `❤️ 2`) displayed cleanly anchored to message bubbles.
  - *Who Reacted Details View*: Tapping any reaction badge opens the detailed reaction sheet/modal:
    - **Laptops & Desktops**: Sleek centered floating modal dialog with quick ✕ dismiss.
    - **Phones & Tablets**: Native iOS/Android-style **Bottom Sheet** sliding up with top grab handle (`—`).
    - **Reaction Filter Tabs**: `All (X)` plus individual emoji tabs (`❤️ 13`, `☕ 1`, etc.) to filter members by reaction.
    - **User Breakdown**: Shows member avatar, display name, username, verified campus, reacted emoji, and a tap-to-remove option for the current user's reaction.
    - **Anywhere Dismiss**: Tapping anywhere outside the sheet on the screen/backdrop, pressing Escape, or swiping back immediately closes it.
  - *Message Actions*: Real-time flat edge-to-edge chat (zero card borders or rounded corners on the message canvas), instant 0ms optimistic sending, 3-dot "More" actions (Delete/Unsend & Copy), 2-line reply preview bars (`Replying to @user`), native Enter-key multiline support, VisualViewport topbar pinning (logo and college name never clipped when mobile virtual keyboard opens), and a pinned top-right mute/unmute notification toggle (`🔔` / `🔕`).
- **Deep AMOLED Black Dark Mode Optimization**: Comprehensive theme overhaul across all screens. Modals (Activity Center, Notification & Privacy, Terms, Help & Support, Karma Leaderboard, Admin Dashboard, Explore, Profile Editor) and home components (hero match card, match poster, statistics buttons, how-it-works cards) now feature pure AMOLED black backgrounds, crisp borders, high-contrast readable typography, and zero light glare.
- **Clean Streamlined Header**: Distraction-free top bar with home theme toggle relocated inside the navigation drawer for an uncluttered reading experience.
- **Laptop Trackpad Gestures**: Natural two-finger left-to-right swipe-to-go-back specifically for macOS and Windows laptop trackpads, while phone users enjoy standard native touchscreen navigation without touch gesture conflicts.
- **Zero-Dependency Frontend**: Pure Vanilla JavaScript and CSS — no heavy frameworks or external font icon dependencies, blazing fast 60fps performance.
- **PWA Ready**: Offline-capable web manifest, mobile splash icons, and full-screen mobile app shell.

---

## 🛠️ Architecture & Tech Stack

```text
┌─────────────────────────────────────────────────────────────┐
│                 Frontend (SPA / PWA)                        │
│   Vanilla JS (ES6+) • Modern CSS3 • Responsive Glassmorphism│
│         Cloudflare Pages (Edge Proxy: functions/api)        │
└──────────────────────────────┬──────────────────────────────┘
                               │ HTTPS / REST API
┌──────────────────────────────▼──────────────────────────────┐
│             Backend (Spring Boot 3.4.3 / Java 17)           │
│   Spring Security Filter • Spring Data JPA • Spring Mail    │
│            Brevo REST API • Railway / Docker                │
└──────────────────────────────┬──────────────────────────────┘
                               │ HikariCP / JDBC
┌──────────────────────────────▼──────────────────────────────┐
│                       Database Layer                        │
│   PostgreSQL 16 (Production)  /  H2 Engine (Local Dev)      │
└─────────────────────────────────────────────────────────────┘
```

| Layer | Technologies Used |
|---|---|
| **Frontend** | HTML5, CSS3 Variables, Vanilla JavaScript (ES6+), PWA WebManifest |
| **Backend** | Spring Boot 3.4.3, Java 17, Spring Web, Spring Data JPA, Hibernate |
| **Database** | PostgreSQL 16 (Production), H2 Database Engine (Local) |
| **Email Service** | Brevo HTTPS Transactional API (Primary), JavaMailSender / SMTP (Fallback) |
| **Deployment** | Railway (Container & PostgreSQL), Cloudflare Pages (Static Edge + Proxy) |
| **Security** | PBKDF2 with Salt, SameSite Cookie Auth, Role-Based Access Control (RBAC) |

---

## 📁 Project Directory Structure

```text
CampUs/
├── src/
│   ├── main/
│   │   ├── java/com/campus/lostfound/
│   │   │   ├── CampusFindApplication.java      # Application entrypoint
│   │   │   ├── AuthController.java             # Login, register, session, OTP reset
│   │   │   ├── AuthTokenFilter.java            # Session & credential validation
│   │   │   ├── ReportController.java           # Lost & found post operations
│   │   │   ├── ItemClaimController.java        # Security question & claim workflow
│   │   │   ├── MarketController.java           # Student buy/sell marketplace
│   │   │   ├── CommunityChatController.java    # Real-time community messages
│   │   │   ├── LeaderboardController.java      # Karma points & rankings
│   │   │   ├── NotificationController.java     # In-app notifications
│   │   │   ├── AdminController.java            # Moderation, roles, audit logs
│   │   │   ├── DatabaseConfig.java             # Dynamic PostgreSQL HikariCP connector
│   │   │   ├── CorsConfig.java                 # Cross-origin policy configuration
│   │   │   └── PasswordHasher.java             # PBKDF2 salting and hashing
│   │   └── resources/
│   │       ├── application.properties          # Base settings & email variables
│   │       ├── application-local.properties    # H2 embedded file database profile
│   │       ├── application-prod.properties     # Production PostgreSQL profile
│   │       └── static/                         # Frontend served directly by Spring Boot
│   │           ├── index.html                  # Core single-page app markup
│   │           ├── app.js                      # Application logic, router, and API client
│   │           ├── style.css                   # Responsive layout, themes, dark mode
│   │           └── avatars/                    # 30+ custom profile illustrations
├── frontend-source/                            # Standalone frontend mirror for edge hosting
├── functions/api/[[path]].js                   # Cloudflare Pages edge proxy to Railway backend
├── data/                                       # Local H2 database file storage
├── Dockerfile                                  # Multi-stage production container build
├── railway.json                                # Railway deployment manifest
├── pom.xml                                     # Maven dependencies & build plugins
└── README.md                                   # Comprehensive documentation
```

---

## ⚡ Quick Start

### Prerequisites
- **Java Development Kit (JDK)**: Version 17 or higher (`java -version`)
- **Apache Maven**: Version 3.8+ (`mvn -version`)
- **Git**

### 1. Clone the Repository
```bash
git clone https://github.com/jayprakashkkk/CampUslnf.git
cd CampUslnf
```

### 2. Run Locally (H2 Database)
No external database setup is needed for local development! The app defaults to the `local` profile with an embedded H2 file database:

```bash
mvn clean spring-boot:run
```

Once started:
- **Application URL**: [http://localhost:8080](http://localhost:8080)
- **Health Check**: [http://localhost:8080/api/health](http://localhost:8080/api/health)
- **Local Database File**: Automatically created in `./data/campusfind.mv.db`

---

## ⚙️ Configuration & Environment Variables

Configure these variables in your `.env` file (local) or in your Cloud Dashboard (Railway / Render):

| Variable | Default Value | Description |
|---|---|---|
| `PORT` | `8080` | Port on which the Spring Boot web server listens |
| `SPRING_PROFILES_ACTIVE` | `local` | Active Spring profile (`local` for H2, `prod` for PostgreSQL) |
| `DATABASE_URL` | *None* | Full PostgreSQL connection URI provided by Railway / Neon |
| `JPA_DDL_AUTO` | `update` | Hibernate schema management (`update` or `validate`) |
| `CAMPUSFIND_OWNER_USERNAME`| *None* | Username assigned the top-level `OWNER` role on registration |
| `BREVO_API_KEY` | *None* | Brevo Transactional Email API Key for reliable OTP delivery |
| `BREVO_SENDER_EMAIL` | *None* | Verified sender email address registered with Brevo |
| `MAIL_HOST` | `smtp.gmail.com` | SMTP host (if using direct SMTP fallback) |
| `MAIL_PORT` | `587` | SMTP port (typically 587 for TLS, 465 for SSL) |
| `MAIL_USERNAME` | *None* | SMTP username / Gmail address |
| `MAIL_PASSWORD` | *None* | SMTP Google App Password (16 characters) |
| `RESET_OTP_MINUTES` | `10` | Expiration window for password recovery OTP codes |
| `SESSION_COOKIE_SAMESITE`| `none` | SameSite cookie policy (`none` for cross-origin HTTPS) |
| `SESSION_COOKIE_SECURE` | `true` | Requires HTTPS for session cookies (`false` for HTTP localhost) |

---

## 🚢 Deployment Guide

### Deploying Backend to Railway

Railway provides effortless deployment with native PostgreSQL integration:

1. **Create Project**:
   - Go to [Railway Dashboard](https://railway.com/) and click **New Project**.
   - Select **Deploy from GitHub repo** and choose your `CampUslnf` repository.

2. **Add PostgreSQL Database**:
   - In the same project canvas, click **+ New** > **Database** > **Add PostgreSQL**.
   - Railway will automatically expose the `DATABASE_URL` variable to your web service.

3. **Configure Environment Variables**:
   Under your CampUs service > **Variables**, add:
   ```env
   SPRING_PROFILES_ACTIVE=prod
   JPA_DDL_AUTO=update
   CAMPUSFIND_OWNER_USERNAME=your_admin_username
   BREVO_API_KEY=your_brevo_key_or_gmail_app_password
   BREVO_SENDER_EMAIL=your_support_email@gmail.com
   SESSION_COOKIE_SAMESITE=none
   SESSION_COOKIE_SECURE=true
   ```

4. **Generate Public Domain**:
   - Go to **Settings** > **Networking** > **Generate Domain**.
   - Your backend will be accessible live at `https://campuslnf-production.up.railway.app`!

---

### Deploying Frontend to Cloudflare Pages

You can host the frontend at edge speed across Cloudflare's global CDN while securely proxying API requests to Railway:

1. In [Cloudflare Pages](https://pages.cloudflare.com/), create a new project connected to this GitHub repository.
2. Set **Build command**: *(leave empty)*.
3. Set **Build output directory**: `/` (or `src/main/resources/static`).
4. The included `functions/api/[[path]].js` automatically routes all `/api/*` network requests directly to your Railway backend host without CORS issues or cold-start interruptions!

---

### Running with Docker

You can build and package the production application into an optimized container:

```bash
# Build the Docker image
docker build -t campus-app:latest .

# Run the container
docker run -p 8080:8080 \
  -e SPRING_PROFILES_ACTIVE=local \
  campus-app:latest
```

---

## 🔌 API Endpoints Reference

### 🔐 Authentication (`/api/`)
| Method | Endpoint | Description | Access |
|---|---|---|---|
| `POST` | `/api/register` | Register a new student profile | Public |
| `POST` | `/api/login` | Authenticate with username/email & password | Public |
| `POST` | `/api/logout` | Terminate session and clear cookies | Authenticated |
| `GET` | `/api/session` | Inspect active login and user details | Authenticated |
| `POST` | `/api/forgot-password/request-otp` | Request 6-digit OTP code to email | Public |
| `POST` | `/api/forgot-password/verify-otp` | Verify OTP and update account password | Public |

### 📦 Lost & Found Reports (`/api/reports`)
| Method | Endpoint | Description | Access |
|---|---|---|---|
| `GET` | `/api/reports` | Fetch listings with optional search & filters | Public |
| `POST` | `/api/reports` | Publish a new lost or found item | Authenticated |
| `GET` | `/api/reports/{id}` | Retrieve full details of an item | Public |
| `PUT` | `/api/reports/{id}` | Update title, description, or status | Owner / Admin |
| `DELETE`| `/api/reports/{id}` | Delete report and cascade clean claims | Owner / Admin |

### 🤝 Claim & Verification (`/api/claims`)
| Method | Endpoint | Description | Access |
|---|---|---|---|
| `POST` | `/api/reports/{id}/claim` | Submit claim with answer to secret question | Authenticated |
| `GET` | `/api/reports/{id}/claims` | View all claims submitted for my report | Finder / Admin |
| `POST` | `/api/claims/{id}/approve` | Approve claimant and mark item returned | Finder / Admin |
| `POST` | `/api/claims/{id}/reject` | Reject invalid or fraudulent claim | Finder / Admin |

### 🛍️ Student Marketplace (`/api/market`)
| Method | Endpoint | Description | Access |
|---|---|---|---|
| `GET` | `/api/market` | List items available for sale/exchange | Public |
| `POST` | `/api/market` | Post a product for sale | Authenticated |
| `DELETE`| `/api/market/{id}` | Remove sold or deleted listing | Owner / Admin |

### 💬 Community Chat & Leaderboard
| Method | Endpoint | Description | Access |
|---|---|---|---|
| `GET` | `/api/chat/messages` | Fetch recent campus chat stream | Authenticated |
| `POST` | `/api/chat/messages` | Send a message (text, reply quote) | Authenticated |
| `DELETE`| `/api/chat/messages/{id}` | Delete message (within 10-min window) | Sender / Admin |
| `GET` | `/api/leaderboard` | View top contributors sorted by karma | Public |

### 🛠️ System & Monitoring
| Method | Endpoint | Description | Access |
|---|---|---|---|
| `GET` | `/api/health` | Healthcheck returning status & app name | Public |
| `GET` | `/api/admin/audit-logs` | Retrieve chronological security audit trail | Admin / Owner |

---

## 🔒 Security & Best Practices

1. **Password Hashing (PBKDF2)**: Passwords are protected using `PBKDF2WithHmacSHA512` over 10,000 iterations with cryptographically random per-user salt.
2. **OTP Protection**: Reset OTPs expire in 10 minutes, are limited to 5 verification attempts, and stored as salted hashes.
3. **Session Hardening**: Cookies utilize `HttpOnly` to eliminate XSS cookie harvesting, and `SameSite=None; Secure` for cross-origin HTTPS deployments.
4. **Input Sanitization**: Request bodies, HTML inputs, and usernames undergo sanitization and regex validation.
5. **No Secrets in Git**: Sensitive credentials (`DATABASE_URL`, `MAIL_PASSWORD`, `BREVO_API_KEY`) must strictly be configured via environment variables.

---

## ❓ Troubleshooting & FAQ

<details>
<summary><b>1. Password reset emails are not arriving. How do I fix this?</b></summary>
<br>
If you are using Gmail SMTP:
1. Ensure your Google Account has <b>2-Step Verification</b> enabled.
2. Create a dedicated 16-character <b>Google App Password</b> (under Security &gt; 2-Step Verification &gt; App Passwords). Do <i>not</i> use your personal Gmail password.
3. Alternatively, supply a free <b>Brevo API Key</b> in <code>BREVO_API_KEY</code>, which bypasses port blocks on cloud hosts.
</details>

<details>
<summary><b>2. How can I assign myself the Owner/Admin role?</b></summary>
<br>
Set the environment variable <code>CAMPUSFIND_OWNER_USERNAME=your_username</code> before launching or in Railway variables. Upon registering that username, the backend automatically grants top-level <code>OWNER</code> privileges.
</details>

<details>
<summary><b>3. The app displays a database connection error on startup.</b></summary>
<br>
Make sure your environment provides a valid <code>DATABASE_URL</code> when <code>SPRING_PROFILES_ACTIVE=prod</code> is set. If testing locally, set <code>SPRING_PROFILES_ACTIVE=local</code> to use the zero-configuration embedded H2 database.
</details>

---

## 👥 Authors & Acknowledgments

- **Lead Developer**: [Jay Prakash Kumar](https://github.com/jayprakashkkk)
- **Repository**: [github.com/jayprakashkkk/CampUslnf](https://github.com/jayprakashkkk/CampUslnf)
- Built with passion for college campuses to connect, protect, and empower students everywhere!

---

<div align="center">
  <sub>Made with ❤️ for students worldwide. © 2026 CampUs. All rights reserved.</sub>
</div>
