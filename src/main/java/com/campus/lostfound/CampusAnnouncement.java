package com.campus.lostfound;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "campus_announcements")
public class CampusAnnouncement {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 150)
    private String title;

    @Column(nullable = false, length = 1500)
    private String message;

    @Column(nullable = false, length = 20)
    private String severity = "INFO"; // INFO, WARNING, EMERGENCY

    @Column(nullable = false)
    private boolean active = true;

    @Column(length = 50)
    private String college = "ALL";

    @Column(length = 50)
    private String createdBy;

    private LocalDateTime createdAt = LocalDateTime.now();

    public CampusAnnouncement() {}

    public CampusAnnouncement(String title, String message, String severity, boolean active, String college, String createdBy) {
        this.title = title;
        this.message = message;
        this.severity = severity == null || severity.isBlank() ? "INFO" : severity.toUpperCase();
        this.active = active;
        this.college = college == null || college.isBlank() ? "ALL" : college;
        this.createdBy = createdBy;
        this.createdAt = LocalDateTime.now();
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getMessage() { return message; }
    public void setMessage(String message) { this.message = message; }
    public String getSeverity() { return severity; }
    public void setSeverity(String severity) { this.severity = severity == null || severity.isBlank() ? "INFO" : severity.toUpperCase(); }
    public boolean isActive() { return active; }
    public void setActive(boolean active) { this.active = active; }
    public String getCollege() { return college; }
    public void setCollege(String college) { this.college = college; }
    public String getCreatedBy() { return createdBy; }
    public void setCreatedBy(String createdBy) { this.createdBy = createdBy; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
