package com.campus.lostfound;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
public interface PasswordResetTokenRepository extends JpaRepository<PasswordResetToken, Long> {
    Optional<PasswordResetToken> findByEmailKey(String emailKey);
    void deleteByEmailKey(String emailKey);
}
