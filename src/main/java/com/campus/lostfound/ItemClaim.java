package com.campus.lostfound;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "item_claims")
public class ItemClaim {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long reportId;

    @Column(nullable = false, length = 50)
    private String claimantUsername;

    @Column(length = 100)
    private String claimantDisplayName;

    @Column(length = 30)
    private String claimantPhone;

    @Column(nullable = false, length = 1000)
    private String answer;

    @Column(length = 1000)
    private String additionalProof;

    @Column(nullable = false, length = 20)
    private String status = "PENDING"; // PENDING, APPROVED, REJECTED

    private LocalDateTime createdAt = LocalDateTime.now();

    public ItemClaim() {}

    public ItemClaim(Long reportId, String claimantUsername, String claimantDisplayName, String claimantPhone, String answer, String additionalProof) {
        this.reportId = reportId;
        this.claimantUsername = claimantUsername;
        this.claimantDisplayName = claimantDisplayName;
        this.claimantPhone = claimantPhone;
        this.answer = answer;
        this.additionalProof = additionalProof;
        this.status = "PENDING";
        this.createdAt = LocalDateTime.now();
    }

    public Long getId() { return id; }
    public Long getReportId() { return reportId; }
    public void setReportId(Long reportId) { this.reportId = reportId; }
    public String getClaimantUsername() { return claimantUsername; }
    public void setClaimantUsername(String claimantUsername) { this.claimantUsername = claimantUsername; }
    public String getClaimantDisplayName() { return claimantDisplayName; }
    public void setClaimantDisplayName(String claimantDisplayName) { this.claimantDisplayName = claimantDisplayName; }
    public String getClaimantPhone() { return claimantPhone; }
    public void setClaimantPhone(String claimantPhone) { this.claimantPhone = claimantPhone; }
    public String getAnswer() { return answer; }
    public void setAnswer(String answer) { this.answer = answer; }
    public String getAdditionalProof() { return additionalProof; }
    public void setAdditionalProof(String additionalProof) { this.additionalProof = additionalProof; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
