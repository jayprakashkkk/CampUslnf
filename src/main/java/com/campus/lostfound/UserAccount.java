package com.campus.lostfound;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDateTime;

@Entity
@Table(name = "campusfind_users")
public class UserAccount {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 50)
    private String username;

    @Column(name = "username_key", nullable = false, unique = true, length = 50)
    private String usernameKey;

    // Nullable for legacy rows; all new registrations require a unique email address.
    @Column(name = "email", length = 254)
    private String email;

    @Column(name = "email_key", unique = true, length = 254)
    private String emailKey;

    @Column(name = "password_hash", nullable = false, length = 200)
    private String passwordHash;

    // Nullable for smooth schema updates of accounts created by earlier project versions.
    @Column(name = "display_name", length = 100)
    private String displayName;

    @Column(name = "phone", length = 30)
    private String phone;

    // Nullable at the database level so accounts from older versions migrate safely.
    @Column(name = "course", length = 100)
    private String course;

    @Column(name = "avatar_id", length = 20)
    private String avatarId;

    // Privileged members may use a custom picture and a profile banner.
    @Column(name = "profile_image_data", columnDefinition = "text")
    private String profileImageData;

    @Column(name = "banner_image_data", columnDefinition = "text")
    private String bannerImageData;

    @Column(name = "account_role", length = 16)
    private String role = "MEMBER";

    // Nullable so older accounts get a safe default (not muted) during schema updates.
    @Column(name = "community_muted")
    private Boolean communityMuted = Boolean.FALSE;

    @Column(nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    // Nullable so existing accounts can be initialized safely after this feature is deployed.
    @Column(name = "username_change_window_start")
    private LocalDateTime usernameChangeWindowStart;

    // Initial username choice counts as use #1 in the first 12-month window.
    @Column(name = "username_changes_used")
    private Integer usernameChangesUsed;

    public UserAccount() {}

    public Long getId() { return id; }
    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }
    public String getUsernameKey() { return usernameKey; }
    public void setUsernameKey(String usernameKey) { this.usernameKey = usernameKey; }
    public String getEmail() { return email == null ? "" : email; }
    public void setEmail(String email) { this.email = email; }
    public String getEmailKey() { return emailKey; }
    public void setEmailKey(String emailKey) { this.emailKey = emailKey; }
    public String getPasswordHash() { return passwordHash; }
    public void setPasswordHash(String passwordHash) { this.passwordHash = passwordHash; }
    public String getDisplayName() { return displayName == null || displayName.isBlank() ? username : displayName; }
    public void setDisplayName(String displayName) { this.displayName = displayName; }
    public String getPhone() { return phone == null ? "" : phone; }
    public void setPhone(String phone) { this.phone = phone; }
    public String getCourse() { return course == null ? "" : course; }
    public void setCourse(String course) { this.course = course; }
    public String getAvatarId() { return avatarId == null ? "" : avatarId; }
    public void setAvatarId(String avatarId) { this.avatarId = avatarId; }
    public String getProfileImageData() { return profileImageData == null ? "" : profileImageData; }
    public void setProfileImageData(String profileImageData) { this.profileImageData = profileImageData; }
    public String getBannerImageData() { return bannerImageData == null ? "" : bannerImageData; }
    public void setBannerImageData(String bannerImageData) { this.bannerImageData = bannerImageData; }
    public String getRole() { return role == null || role.isBlank() ? "MEMBER" : role.toUpperCase(java.util.Locale.ROOT); }
    public void setRole(String role) { this.role = role == null || role.isBlank() ? "MEMBER" : role.toUpperCase(java.util.Locale.ROOT); }
    public boolean isCommunityMuted() { return Boolean.TRUE.equals(communityMuted); }
    public void setCommunityMuted(Boolean communityMuted) { this.communityMuted = communityMuted; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getUsernameChangeWindowStart() { return usernameChangeWindowStart; }
    public void setUsernameChangeWindowStart(LocalDateTime usernameChangeWindowStart) { this.usernameChangeWindowStart = usernameChangeWindowStart; }
    public Integer getUsernameChangesUsed() { return usernameChangesUsed; }
    public void setUsernameChangesUsed(Integer usernameChangesUsed) { this.usernameChangesUsed = usernameChangesUsed; }
}
