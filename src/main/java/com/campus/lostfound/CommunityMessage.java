package com.campus.lostfound;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "community_messages")
public class CommunityMessage {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(nullable=false, length=50) private String username;
    @Column(nullable=false, length=100) private String displayName;
    @Column(nullable=false, length=2000) private String message;
    @Column(length=2000) private String replyText;
    @Column(length=100) private String replyName;
    @Column(nullable=false) private LocalDateTime createdAt;
    protected CommunityMessage() {}
    public CommunityMessage(String username, String displayName, String message, String replyText, String replyName) {
        this.username=username; this.displayName=displayName; this.message=message; this.replyText=replyText; this.replyName=replyName; this.createdAt=LocalDateTime.now();
    }
    public Long getId(){return id;} public String getUsername(){return username;} public void setUsername(String username){this.username=username;} public String getDisplayName(){return displayName;} public void setDisplayName(String displayName){this.displayName=displayName;}
    public String getMessage(){return message;} public String getReplyText(){return replyText;} public String getReplyName(){return replyName;} public LocalDateTime getCreatedAt(){return createdAt;}
}
