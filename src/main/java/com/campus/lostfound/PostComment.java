package com.campus.lostfound;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "post_comments")
public class PostComment {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long reportId;

    @Column(nullable = false)
    private String username;

    @Column(length = 1000, nullable = false)
    private String content;

    private Long parentCommentId;
    private String replyToUsername;

    private LocalDateTime createdAt = LocalDateTime.now();

    @Transient private String userDisplayName;
    @Transient private String userAvatarId;
    @Transient private String userProfileImageUrl;
    @Transient private String userRole;
    @Transient private List<PostComment> replies = new ArrayList<>();

    public PostComment() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getReportId() { return reportId; }
    public void setReportId(Long reportId) { this.reportId = reportId; }
    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }
    public String getContent() { return content; }
    public void setContent(String content) { this.content = content; }
    public Long getParentCommentId() { return parentCommentId; }
    public void setParentCommentId(Long parentCommentId) { this.parentCommentId = parentCommentId; }
    public String getReplyToUsername() { return replyToUsername; }
    public void setReplyToUsername(String replyToUsername) { this.replyToUsername = replyToUsername; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public String getUserDisplayName() { return userDisplayName; }
    public void setUserDisplayName(String userDisplayName) { this.userDisplayName = userDisplayName; }
    public String getUserAvatarId() { return userAvatarId; }
    public void setUserAvatarId(String userAvatarId) { this.userAvatarId = userAvatarId; }
    public String getUserProfileImageUrl() { return userProfileImageUrl; }
    public void setUserProfileImageUrl(String userProfileImageUrl) { this.userProfileImageUrl = userProfileImageUrl; }
    public String getUserRole() { return userRole; }
    public void setUserRole(String userRole) { this.userRole = userRole; }
    public List<PostComment> getReplies() { return replies; }
    public void setReplies(List<PostComment> replies) { this.replies = replies; }
}
