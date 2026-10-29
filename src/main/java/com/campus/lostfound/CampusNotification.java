package com.campus.lostfound;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDateTime;

@Entity
@Table(name = "campusfind_notifications")
public class CampusNotification {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "recipient_user_id", nullable = false)
    private Long recipientUserId;

    @Column(nullable = false, length = 20)
    private String type;

    @Column(nullable = false, length = 120)
    private String title;

    @Column(nullable = false, length = 500)
    private String message;

    @Column(name = "actor_username", length = 50)
    private String actorUsername;

    @Column(name = "actor_display_name", length = 100)
    private String actorDisplayName;

    @Column(name = "related_report_id")
    private Long relatedReportId;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "is_read", nullable = false)
    private boolean readFlag = false;

    protected CampusNotification() {}

    public CampusNotification(Long recipientUserId, String type, String title, String message,
                              String actorUsername, String actorDisplayName, Long relatedReportId) {
        this.recipientUserId = recipientUserId;
        this.type = type;
        this.title = title;
        this.message = message;
        this.actorUsername = actorUsername;
        this.actorDisplayName = actorDisplayName;
        this.relatedReportId = relatedReportId;
        this.createdAt = LocalDateTime.now();
        this.readFlag = false;
    }

    public Long getId() { return id; }
    public Long getRecipientUserId() { return recipientUserId; }
    public String getType() { return type; }
    public String getTitle() { return title; }
    public String getMessage() { return message; }
    public String getActorUsername() { return actorUsername; }
    public String getActorDisplayName() { return actorDisplayName; }
    public Long getRelatedReportId() { return relatedReportId; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public boolean isReadFlag() { return readFlag; }
    public void setReadFlag(boolean readFlag) { this.readFlag = readFlag; }
}
