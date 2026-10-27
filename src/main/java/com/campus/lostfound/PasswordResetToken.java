package com.campus.lostfound;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "campusfind_password_reset_tokens")
public class PasswordResetToken {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(name="email_key", nullable=false, unique=true, length=254)
    private String emailKey;
    @Column(name="otp_hash", nullable=false, length=200)
    private String otpHash;
    @Column(name="expires_at", nullable=false)
    private LocalDateTime expiresAt;
    @Column(nullable=false)
    private int attempts = 0;
    @Column(name="created_at", nullable=false)
    private LocalDateTime createdAt = LocalDateTime.now();
    public PasswordResetToken() {}
    public Long getId(){return id;}
    public String getEmailKey(){return emailKey;}
    public void setEmailKey(String v){emailKey=v;}
    public String getOtpHash(){return otpHash;}
    public void setOtpHash(String v){otpHash=v;}
    public LocalDateTime getExpiresAt(){return expiresAt;}
    public void setExpiresAt(LocalDateTime v){expiresAt=v;}
    public int getAttempts(){return attempts;}
    public void setAttempts(int v){attempts=v;}
    public LocalDateTime getCreatedAt(){return createdAt;}
    public void setCreatedAt(LocalDateTime v){createdAt=v;}
}
