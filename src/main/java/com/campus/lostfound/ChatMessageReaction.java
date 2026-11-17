package com.campus.lostfound;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "chat_message_reactions", indexes = {
    @Index(name = "idx_cmr_message_id", columnList = "messageId"),
    @Index(name = "idx_cmr_msg_user", columnList = "messageId, username")
})
public class ChatMessageReaction {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long messageId;

    @Column(nullable = false, length = 50)
    private String username;

    @Column(length = 100)
    private String displayName;

    @Column(length = 50)
    private String avatarId;

    @Column(length = 300)
    private String profileImageUrl;

    @Column(length = 100)
    private String college;

    @Column(nullable = false, length = 16)
    private String emoji;

    @Column(nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    protected ChatMessageReaction() {}

    public ChatMessageReaction(Long messageId, String username, String displayName, String avatarId, String profileImageUrl, String college, String emoji) {
        this.messageId = messageId;
        this.username = username;
        this.displayName = displayName;
        this.avatarId = avatarId;
        this.profileImageUrl = profileImageUrl;
        this.college = college;
        this.emoji = emoji;
        this.createdAt = LocalDateTime.now();
    }

    public Long getId() { return id; }
    public Long getMessageId() { return messageId; }
    public void setMessageId(Long messageId) { this.messageId = messageId; }
    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }
    public String getDisplayName() { return displayName; }
    public void setDisplayName(String displayName) { this.displayName = displayName; }
    public String getAvatarId() { return avatarId; }
    public void setAvatarId(String avatarId) { this.avatarId = avatarId; }
    public String getProfileImageUrl() { return profileImageUrl; }
    public void setProfileImageUrl(String profileImageUrl) { this.profileImageUrl = profileImageUrl; }
    public String getCollege() { return college; }
    public void setCollege(String college) { this.college = college; }
    public String getEmoji() { return emoji; }
    public void setEmoji(String emoji) { this.emoji = emoji; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
