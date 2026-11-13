package com.campus.lostfound;

import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;
import java.net.URI;
import javax.sql.DataSource;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnExpression;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;

/**
 * Automatically configures PostgreSQL DataSource for Railway, Render, Supabase, Neon, or generic environments.
 * Activates whenever a PostgreSQL URL or production profile is specified.
 */
@Configuration
public class DatabaseConfig {
    private static final Logger log = LoggerFactory.getLogger(DatabaseConfig.class);

    @Value("${SPRING_DATASOURCE_URL:#{null}}")
    private String springDatasourceUrl;

    @Value("${SPRING_DATASOURCE_USERNAME:#{null}}")
    private String springDatasourceUsername;

    @Value("${SPRING_DATASOURCE_PASSWORD:#{null}}")
    private String springDatasourcePassword;

    @Value("${DATABASE_URL:#{null}}")
    private String databaseUrl;

    @Value("${DATABASE_PUBLIC_URL:#{null}}")
    private String databasePublicUrl;

    @Value("${PGHOST:#{null}}")
    private String pgHost;

    @Value("${PGPORT:#{null}}")
    private String pgPort;

    @Value("${PGUSER:#{null}}")
    private String pgUser;

    @Value("${PGPASSWORD:#{null}}")
    private String pgPassword;

    @Value("${PGDATABASE:#{null}}")
    private String pgDatabase;

    @Bean
    @Primary
    @ConditionalOnExpression(
        "'${spring.profiles.active:local}'.equals('prod') " +
        "|| '${DATABASE_URL:}' != '' " +
        "|| '${DATABASE_PUBLIC_URL:}' != '' " +
        "|| '${PGHOST:}' != ''"
    )
    public DataSource dataSource() {
        HikariConfig config = new HikariConfig();
        config.setDriverClassName("org.postgresql.Driver");

        // 1. Explicit Spring datasource url (e.g. jdbc:postgresql://...)
        if (springDatasourceUrl != null && !springDatasourceUrl.isBlank() && !springDatasourceUrl.contains("${")) {
            log.info("Configuring DataSource from SPRING_DATASOURCE_URL");
            config.setJdbcUrl(springDatasourceUrl);
            if (springDatasourceUsername != null && !springDatasourceUsername.isBlank()) {
                config.setUsername(springDatasourceUsername);
            }
            if (springDatasourcePassword != null) {
                config.setPassword(springDatasourcePassword);
            }
            applyPoolSettings(config);
            return new HikariDataSource(config);
        }

        // 2. Railway / Heroku standard DATABASE_URL or DATABASE_PUBLIC_URL
        String rawDbUrl = (databaseUrl != null && !databaseUrl.isBlank()) ? databaseUrl : databasePublicUrl;
        if (rawDbUrl != null && !rawDbUrl.isBlank()) {
            log.info("Configuring DataSource from Railway DATABASE_URL");
            configureFromUri(config, rawDbUrl);
            applyPoolSettings(config);
            return new HikariDataSource(config);
        }

        // 3. Railway individual PG* variables
        if (pgHost != null && !pgHost.isBlank()) {
            log.info("Configuring DataSource from Railway PGHOST environment variables");
            String port = (pgPort != null && !pgPort.isBlank()) ? pgPort : "5432";
            String db = (pgDatabase != null && !pgDatabase.isBlank()) ? pgDatabase : "railway";
            config.setJdbcUrl("jdbc:postgresql://" + pgHost + ":" + port + "/" + db + "?sslmode=require");
            if (pgUser != null) config.setUsername(pgUser);
            if (pgPassword != null) config.setPassword(pgPassword);
            applyPoolSettings(config);
            return new HikariDataSource(config);
        }

        throw new IllegalStateException("Production database configuration requested, but no connection details provided.");
    }

    private void configureFromUri(HikariConfig config, String rawUrl) {
        try {
            if (rawUrl.startsWith("jdbc:postgresql://")) {
                config.setJdbcUrl(rawUrl);
                return;
            }
            URI uri = new URI(rawUrl);
            String userInfo = uri.getUserInfo();
            if (userInfo != null && !userInfo.isBlank()) {
                String[] parts = userInfo.split(":", 2);
                config.setUsername(parts[0]);
                if (parts.length > 1) {
                    config.setPassword(parts[1]);
                }
            }
            int port = uri.getPort() > 0 ? uri.getPort() : 5432;
            String path = uri.getPath();
            if (path != null && path.startsWith("/")) {
                path = path.substring(1);
            }
            String query = uri.getQuery();
            String jdbcUrl = "jdbc:postgresql://" + uri.getHost() + ":" + port + "/" + path;
            if (query != null && !query.isBlank()) {
                jdbcUrl += "?" + query;
            } else {
                jdbcUrl += "?sslmode=require";
            }
            config.setJdbcUrl(jdbcUrl);
        } catch (Exception e) {
            log.warn("Could not parse database URI ({}), falling back to direct jdbc prefix: {}", rawUrl, e.getMessage());
            config.setJdbcUrl(rawUrl.startsWith("jdbc:") ? rawUrl : "jdbc:" + rawUrl);
        }
    }

    private void applyPoolSettings(HikariConfig config) {
        config.setMaximumPoolSize(10);
        config.setMinimumIdle(2);
        config.setConnectionTimeout(30000);
        config.setIdleTimeout(600000);
        config.setMaxLifetime(1800000);
    }
}
