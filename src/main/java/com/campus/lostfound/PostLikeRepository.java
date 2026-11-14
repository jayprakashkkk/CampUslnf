package com.campus.lostfound;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface PostLikeRepository extends JpaRepository<PostLike, Long> {
    boolean existsByReportIdAndUsername(Long reportId, String username);
    long countByReportId(Long reportId);
    void deleteByReportIdAndUsername(Long reportId, String username);
    List<PostLike> findByUsernameOrderByCreatedAtDesc(String username);
    void deleteByReportId(Long reportId);
}
