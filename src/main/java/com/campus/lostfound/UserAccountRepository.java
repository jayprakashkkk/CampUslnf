package com.campus.lostfound;

import java.util.Optional;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface UserAccountRepository extends JpaRepository<UserAccount, Long> {
    boolean existsByUsernameKey(String usernameKey);
    Optional<UserAccount> findByUsernameKey(String usernameKey);
    boolean existsByEmailKey(String emailKey);
    Optional<UserAccount> findByEmailKey(String emailKey);
    Optional<UserAccount> findByAuthToken(String authToken);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select u from UserAccount u where u.id = :id")
    Optional<UserAccount> findByIdForUpdate(@Param("id") Long id);
}
