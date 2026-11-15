package com.campus.lostfound;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/market")
public class MarketController {

    private final MarketListingRepository marketRepo;
    private final UserAccountRepository users;

    public MarketController(MarketListingRepository marketRepo, UserAccountRepository users) {
        this.marketRepo = marketRepo;
        this.users = users;
    }

    private UserAccount requireLogin(HttpServletRequest request) {
        if (!AuthController.isLoggedIn(request)) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Please log in.");
        }
        HttpSession session = request.getSession(false);
        Long uid = session != null ? (Long) session.getAttribute(AuthController.SESSION_USER_ID) : null;
        UserAccount u = uid != null ? users.findById(uid).orElse(null) : null;
        if (u == null) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Account not found.");
        return u;
    }

    @GetMapping
    public ResponseEntity<?> listMarket(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String category,
            @RequestParam(required = false) String condition,
            @RequestParam(required = false) String college,
            @RequestParam(required = false) Double maxPrice,
            @RequestParam(required = false) Boolean freeOnly) {

        List<MarketListing> list = marketRepo.findAllByOrderByCreatedAtDesc();

        if (category != null && !category.isBlank() && !"ALL".equalsIgnoreCase(category)) {
            list = list.stream().filter(m -> category.equalsIgnoreCase(m.getCategory())).toList();
        }

        if (condition != null && !condition.isBlank() && !"ALL".equalsIgnoreCase(condition)) {
            list = list.stream().filter(m -> condition.equalsIgnoreCase(m.getCondition())).toList();
        }

        if (college != null && !college.isBlank() && !"ALL".equalsIgnoreCase(college)) {
            list = list.stream().filter(m -> college.equalsIgnoreCase(m.getCollege())).toList();
        }

        if (Boolean.TRUE.equals(freeOnly)) {
            list = list.stream().filter(m -> m.getPrice() <= 0.0).toList();
        } else if (maxPrice != null && maxPrice > 0) {
            list = list.stream().filter(m -> m.getPrice() <= maxPrice).toList();
        }

        if (search != null && !search.isBlank()) {
            String q = search.trim().toLowerCase(Locale.ROOT);
            list = list.stream().filter(m ->
                    (m.getTitle() != null && m.getTitle().toLowerCase(Locale.ROOT).contains(q)) ||
                    (m.getDescription() != null && m.getDescription().toLowerCase(Locale.ROOT).contains(q)) ||
                    (m.getLocation() != null && m.getLocation().toLowerCase(Locale.ROOT).contains(q)) ||
                    (m.getCategory() != null && m.getCategory().toLowerCase(Locale.ROOT).contains(q)) ||
                    (m.getSellerDisplayName() != null && m.getSellerDisplayName().toLowerCase(Locale.ROOT).contains(q))
            ).toList();
        }

        return ResponseEntity.ok(list);
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> getMarketItem(@PathVariable Long id) {
        MarketListing item = marketRepo.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Item not found."));
        return ResponseEntity.ok(item);
    }

    @PostMapping
    @Transactional
    public ResponseEntity<?> createMarketItem(@RequestBody MarketListing payload, HttpServletRequest request) {
        UserAccount user = requireLogin(request);

        if (payload.getTitle() == null || payload.getTitle().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("message", "Item title is required."));
        }
        if (payload.getCategory() == null || payload.getCategory().isBlank()) {
            payload.setCategory("Other");
        }

        payload.setSellerUsername(user.getUsername());
        payload.setSellerDisplayName(user.getDisplayName());
        payload.setCollege(user.getCollege());
        if (payload.getSellerPhone() == null || payload.getSellerPhone().isBlank()) {
            payload.setSellerPhone(user.getPhone());
        }
        payload.setStatus("AVAILABLE");

        MarketListing saved = marketRepo.save(payload);
        return ResponseEntity.status(HttpStatus.CREATED).body(saved);
    }

    @PostMapping("/{id}/sold")
    @Transactional
    public ResponseEntity<?> markSold(@PathVariable Long id, HttpServletRequest request) {
        UserAccount user = requireLogin(request);
        MarketListing item = marketRepo.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Item not found."));

        boolean isSeller = user.getUsername().equalsIgnoreCase(item.getSellerUsername());
        boolean isPrivileged = List.of("OWNER", "ADMIN").contains(user.getRole());
        if (!isSeller && !isPrivileged) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Not authorized.");
        }

        item.setStatus("SOLD".equalsIgnoreCase(item.getStatus()) ? "AVAILABLE" : "SOLD");
        marketRepo.save(item);
        return ResponseEntity.ok(Map.of("status", item.getStatus(), "message", "Listing status updated."));
    }

    @DeleteMapping("/{id}")
    @Transactional
    public ResponseEntity<?> deleteMarketItem(@PathVariable Long id, HttpServletRequest request) {
        UserAccount user = requireLogin(request);
        MarketListing item = marketRepo.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Item not found."));

        boolean isSeller = user.getUsername().equalsIgnoreCase(item.getSellerUsername());
        boolean isPrivileged = List.of("OWNER", "ADMIN").contains(user.getRole());
        if (!isSeller && !isPrivileged) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Not authorized.");
        }

        marketRepo.delete(item);
        return ResponseEntity.ok(Map.of("message", "Listing deleted.", "deleted", true));
    }
}
