# CampUs — Full-Stack Spring Boot + Railway Production Project

CampUs is a full-stack campus Lost & Found and community platform built with Spring Boot (Java 17), PostgreSQL, and a responsive frontend.

## Project Structure
- `pom.xml` — Maven & Spring Boot dependencies (Web, Data JPA, Mail, PostgreSQL, H2).
- `Dockerfile` & `railway.json` — Production deployment configuration for Railway.
- `src/main/java/com/campus/lostfound/` — REST controllers, entities, repositories, authentication, chat, and notification services.
- `src/main/resources/application.properties` — Base configuration & Railway reverse proxy settings.
- `src/main/resources/application-local.properties` — Local H2 file database profile.
- `src/main/resources/application-prod.properties` — Production profile for PostgreSQL.
- `src/main/resources/static/` — Frontend served directly by Spring Boot.
- `frontend-source/` — Standalone copy of the frontend files.

## Running Locally
Requirements: Java 17+ and Maven 3.6+.

```bash
mvn spring-boot:run
```
Open [http://localhost:8080](http://localhost:8080).
By default, the `local` profile uses a local H2 database file stored at `./data/campusfind.mv.db`.

## Deploying to Railway (Recommended)

1. **Push this repository to GitHub** (see instructions below).
2. Go to [Railway](https://railway.com/) and create a **New Project**.
3. Select **Deploy from GitHub repo** and choose your repository.
4. In the same project, click **+ New** > **Database** > **Add PostgreSQL**.
5. Railway will automatically link the database by providing `DATABASE_URL`.
   - The app's `DatabaseConfig` automatically detects Railway's `DATABASE_URL`, parses it, and connects via HikariCP!
6. In your Web Service settings, set the following environment variables under **Variables**:
   ```text
   SPRING_PROFILES_ACTIVE=prod
   JPA_DDL_AUTO=update
   CAMPUSFIND_OWNER_USERNAME=your-username
   ```
7. Click **Generate Domain** under Settings > Networking to get your public URL (e.g. `https://campus-production.up.railway.app`).

## Features & Fixes
- **Authentication**: Registration with university email, login by username OR email, server-side session management, PBKDF2 password hashing.
- **Forgot Password**: 6-digit email OTP password recovery.
- **Community Chat**: Real-time polling campus chat with swipe/tap to reply, message deletion within 10 minutes, user roles (Owner, Admin, Leader, Moderator, Member), and custom avatars.
- **Lost & Found Reports**: Create lost/found listings with compressed image uploads, search, filters, and status tracking (Open, Matched, Returned).
- **CORS & Proxy Support**: Built-in `CorsConfig` and `server.forward-headers-strategy=framework` for smooth deployment on Railway.

## Health Check
Verify backend status at:
`http://localhost:8080/api/health` or `https://your-app.up.railway.app/api/health`
Response: `{"status": "ok", "application": "CampUs"}`
