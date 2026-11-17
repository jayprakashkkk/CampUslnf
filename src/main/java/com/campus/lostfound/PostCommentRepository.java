package com.campus.lostfound;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface PostCommentRepository extends JpaRepository<PostComment, Long> {
    List<PostComment> findByReportIdOrderByCreatedAtAsc(Long reportId);
    List<PostComment> findByReportIdIn(java.util.Collection<Long> reportIds);
    long countByReportId(Long reportId);
    void deleteByReportId(Long reportId);
}
