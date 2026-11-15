package com.campus.lostfound;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface MarketListingRepository extends JpaRepository<MarketListing, Long> {
    List<MarketListing> findAllByOrderByCreatedAtDesc();
    List<MarketListing> findBySellerUsernameOrderByCreatedAtDesc(String sellerUsername);
    List<MarketListing> findByCollegeOrderByCreatedAtDesc(String college);
}
