# CampUs / CampusFind — Restored Spring Boot + PostgreSQL-ready project

This project combines the latest CampUs frontend with the Spring Boot backend recovered from `CampusFind(3).zip`.

## Restored backend files
- `pom.xml` — Maven / Spring Boot dependencies.
- `src/main/java/com/campus/lostfound/` — REST API controllers, entities, repositories, session login, reports, community chat, notifications, and profile/role logic.
- `src/main/resources/application.properties` — base Spring configuration.
- `src/main/resources/application-local.properties` — local H2 file database for development.
- `src/main/resources/application-prod.properties` — hosted PostgreSQL configuration.

## What was updated
- Replaced the static frontend with the latest CampUs UI, including the university-email field on Create Account and the removed in-form Back button.
- Added email/email-key fields to the user entity. New registrations require a valid, unique email address and persist it in the database.
- Login accepts either the username or the registered email address.
- Existing accounts remain compatible because email columns are nullable for older rows; old accounts without email will need their email added before they can use email login.

## Run locally
Requirements: Java 17+ and Maven 3.6+.

```bash
mvn spring-boot:run
```

Open `http://localhost:8080`. Local development uses a file-backed H2 database at `./data/campusfind.mv.db`, so data persists between restarts on that computer. This local file is not the hosted production database.

## Use a real hosted database in production
The production profile is already configured for PostgreSQL, but you still need to create a managed PostgreSQL database (for example, on Neon, Supabase Database, or your hosting provider). The database is **not** created by this ZIP and no database password is included.

Set these environment variables on the backend hosting service:

```text
SPRING_PROFILES_ACTIVE=prod
SPRING_DATASOURCE_URL=jdbc:postgresql://HOST:5432/DATABASE?sslmode=require
SPRING_DATASOURCE_USERNAME=YOUR_DATABASE_USERNAME
SPRING_DATASOURCE_PASSWORD=YOUR_DATABASE_PASSWORD
JPA_DDL_AUTO=update
CAMPUSFIND_OWNER_USERNAME=your-owner-username
```

Replace `HOST`, `DATABASE`, and credentials with the exact values from your database provider. Keep credentials in the hosting provider's private environment settings; do not commit them to GitHub or send them in chat. The Dockerfile builds the app for Java 17 and starts the Spring Boot server. The app reads the host-provided `PORT` value.

For a public website, the Java backend must run on a backend-capable host (such as Render or Railway); Netlify alone does not run Spring Boot. Either serve the frontend from this same Spring Boot app, or configure the Netlify frontend to call the hosted backend URL and configure CORS accordingly. This ZIP's frontend currently uses relative `/api/...` paths, so serving frontend and API from the same Spring Boot origin is the straightforward setup.

## Important limitations
- The original H2 database file was not found in the earlier local search, and this ZIP does not contain it. Existing local accounts/reports cannot be migrated unless that database file is recovered.
- Passwords are hashed; the app uses server-side sessions.
- The recovered backend does not yet implement email OTP / forgot-password endpoints. That needs a separate feature before advertising password recovery as available.
- Before sharing publicly, configure HTTPS, backups, SMTP and password recovery, request rate limiting, and review access controls. Test with a non-production database first.

## API smoke check
After the app starts, open `http://localhost:8080/api/health`. It should return a small JSON response with `status: ok`.
