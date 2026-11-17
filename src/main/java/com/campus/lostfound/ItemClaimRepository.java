package com.campus.lostfound;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface ItemClaimRepository extends JpaRepository<ItemClaim, Long> {
    List<ItemClaim> findByReportIdOrderByCreatedAtDesc(Long reportId);
    List<ItemClaim> findByClaimantUsernameOrderByCreatedAtDesc(String claimantUsername);
    List<ItemClaim> findByReportIdIn(java.util.Collection<Long> reportIds);
    long countByReportId(Long reportId);
    void deleteByReportId(Long reportId);
}
