# CampUs — Getting Started & Railway Setup

## 1. Run Locally
```bash
mvn spring-boot:run
```
Open [http://localhost:8080](http://localhost:8080).
Data is stored locally in `./data/campusfind.mv.db`.

## 2. Deploy to Railway
1. Push this project to GitHub.
2. In Railway, click **New Project** > **Deploy from GitHub repo**.
3. Add a PostgreSQL database in the same project (**+ New** > **Database** > **PostgreSQL**).
4. Add environment variables under **Variables**:
   - `SPRING_PROFILES_ACTIVE` = `prod`
   - `JPA_DDL_AUTO` = `update`
   - `CAMPUSFIND_OWNER_USERNAME` = `your-admin-username`
5. Generate a public domain under service **Settings** > **Networking**.

The backend automatically connects to Railway Postgres via `DATABASE_URL` and serves the frontend from the root domain!
