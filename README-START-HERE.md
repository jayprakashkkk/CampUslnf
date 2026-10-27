# CampUs — Full-stack Spring Boot project

This package combines the current CampUs frontend with the Spring Boot backend source.

## Project structure
- `pom.xml` — Maven / Spring Boot build
- `src/main/java/com/campus/lostfound/` — backend Java source
- `src/main/resources/application.properties` — base configuration
- `src/main/resources/application-local.properties` — local H2 database profile
- `src/main/resources/application-prod.properties` — hosted PostgreSQL profile
- `src/main/resources/static/` — frontend served by Spring Boot
- `frontend-source/` — editable copy of the frontend files

## Run locally
Requires Java 17+ and Maven (or use the Maven wrapper if you add one).

```bash
mvn spring-boot:run
```

Open `http://localhost:8080`.

The default profile is `local`, which uses a local H2 database. This is for local development, not a shared hosted production database.

## Hosted PostgreSQL
Create a managed PostgreSQL database (for example Neon or Supabase Postgres), then set these environment variables on the backend host:

```text
SPRING_PROFILES_ACTIVE=prod
SPRING_DATASOURCE_URL=jdbc:postgresql://HOST:5432/DATABASE?sslmode=require
SPRING_DATASOURCE_USERNAME=DATABASE_USER
SPRING_DATASOURCE_PASSWORD=DATABASE_PASSWORD
JPA_DDL_AUTO=update
```

Do not commit database credentials into this project or send them in chat. `SPRING_DATASOURCE_URL` must be a JDBC URL, not the provider's generic URL.

## Deploying
Deploy this Maven/Spring Boot project to a Java-capable host such as Render or Railway. Netlify alone cannot run the Java backend. If the frontend is served from the Spring Boot app as packaged here, the app serves both frontend and API from the same origin.

## Important limitations
- This package includes the backend source and PostgreSQL profile configuration; a live hosted database is not created or connected until the environment variables are configured on a database host.
- Verify the Maven build and test signup/login against your chosen PostgreSQL database before considering deployment complete.
- Email is sent/accepted as part of signup data, and login supports username or email where the frontend supplies it. A forgot-password OTP/email reset flow is not included in this package yet.
