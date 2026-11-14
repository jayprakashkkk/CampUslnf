package com.campus.lostfound;

import jakarta.persistence.*;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
public class Report {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String type;
    private String title;
    private String category;
    private String location;
    private String reporterName;
    private String reporterEmail;
    private String reporterPhone;
    private String status = "OPEN";
    private String accountUsername;
    private String college = "CU";

    @Column(length = 1200)
    private String description;

    @Column(columnDefinition = "text")
    private String imageData;

    private LocalDate itemDate;
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(nullable = false)
    private boolean archived = false;
    private LocalDateTime archivedAt;

    @Column(nullable = false)
    private boolean deleted = false;
    private LocalDateTime deletedAt;

    @Transient private String ownerDisplayName;
    @Transient private String ownerCourse;
    @Transient private String ownerAvatarId;
    @Transient private String ownerProfileImageUrl;
    @Transient private String ownerRole;

    @Transient private Long daysRemaining;
    @Transient private Long commentCount = 0L;
    @Transient private Long likeCount = 0L;
    @Transient private Boolean likedByMe = false;

    public Report() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getType() { return type; }
    public void setType(String type) { this.type = type; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }
    public String getLocation() { return location; }
    public void setLocation(String location) { this.location = location; }
    public String getReporterName() { return reporterName; }
    public void setReporterName(String reporterName) { this.reporterName = reporterName; }
    public String getReporterEmail() { return reporterEmail; }
    public void setReporterEmail(String reporterEmail) { this.reporterEmail = reporterEmail; }
    public String getReporterPhone() { return reporterPhone; }
    public void setReporterPhone(String reporterPhone) { this.reporterPhone = reporterPhone; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public String getAccountUsername() { return accountUsername; }
    public void setAccountUsername(String accountUsername) { this.accountUsername = accountUsername; }
    public String getCollege() { return college == null || college.isBlank() ? "CU" : college; }
    public void setCollege(String college) { this.college = college; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public String getImageData() { return imageData; }
    public void setImageData(String imageData) { this.imageData = imageData; }
    public LocalDate getItemDate() { return itemDate; }
    public void setItemDate(LocalDate itemDate) { this.itemDate = itemDate; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public boolean isArchived() { return archived; }
    public void setArchived(boolean archived) { this.archived = archived; }
    public LocalDateTime getArchivedAt() { return archivedAt; }
    public void setArchivedAt(LocalDateTime archivedAt) { this.archivedAt = archivedAt; }

    public boolean isDeleted() { return deleted; }
    public void setDeleted(boolean deleted) { this.deleted = deleted; }
    public LocalDateTime getDeletedAt() { return deletedAt; }
    public void setDeletedAt(LocalDateTime deletedAt) { this.deletedAt = deletedAt; }

    public String getOwnerDisplayName() { return ownerDisplayName; }
    public void setOwnerDisplayName(String ownerDisplayName) { this.ownerDisplayName = ownerDisplayName; }
    public String getOwnerCourse() { return ownerCourse == null ? "" : ownerCourse; }
    public void setOwnerCourse(String ownerCourse) { this.ownerCourse = ownerCourse; }
    public String getOwnerAvatarId() { return ownerAvatarId == null ? "" : ownerAvatarId; }
    public void setOwnerAvatarId(String ownerAvatarId) { this.ownerAvatarId = ownerAvatarId; }
    public String getOwnerProfileImageUrl() { return ownerProfileImageUrl == null ? "" : ownerProfileImageUrl; }
    public void setOwnerProfileImageUrl(String ownerProfileImageUrl) { this.ownerProfileImageUrl = ownerProfileImageUrl; }
    public String getOwnerRole() { return ownerRole == null ? "MEMBER" : ownerRole; }
    public void setOwnerRole(String ownerRole) { this.ownerRole = ownerRole; }

    public Long getDaysRemaining() { return daysRemaining; }
    public void setDaysRemaining(Long daysRemaining) { this.daysRemaining = daysRemaining; }
    public Long getCommentCount() { return commentCount == null ? 0L : commentCount; }
    public void setCommentCount(Long commentCount) { this.commentCount = commentCount; }
    public Long getLikeCount() { return likeCount == null ? 0L : likeCount; }
    public void setLikeCount(Long likeCount) { this.likeCount = likeCount; }
    public Boolean getLikedByMe() { return likedByMe != null && likedByMe; }
    public void setLikedByMe(Boolean likedByMe) { this.likedByMe = likedByMe; }
}
