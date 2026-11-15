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
@RequestMapping("/api")
public class ItemClaimController {

    private final ItemClaimRepository claims;
    private final ReportRepository reports;
    private final UserAccountRepository users;
    private final NotificationService notificationService;

    public ItemClaimController(
            ItemClaimRepository claims,
            ReportRepository reports,
            UserAccountRepository users,
            NotificationService notificationService) {
        this.claims = claims;
        this.reports = reports;
        this.users = users;
        this.notificationService = notificationService;
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

    @PostMapping("/reports/{id}/claim")
    @Transactional
    public ResponseEntity<?> submitClaim(
            @PathVariable Long id,
            @RequestBody Map<String, String> body,
            HttpServletRequest request) {
        UserAccount user = requireLogin(request);
        Report report = reports.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Report not found."));

        if (user.getUsername().equalsIgnoreCase(report.getAccountUsername())) {
            return ResponseEntity.badRequest().body(Map.of("message", "You cannot claim your own report."));
        }

        String answer = body != null && body.get("answer") != null ? body.get("answer").trim() : "";
        String additionalProof = body != null && body.get("additionalProof") != null ? body.get("additionalProof").trim() : "";
        String phone = body != null && body.get("phone") != null ? body.get("phone").trim() : user.getPhone();

        if (answer.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("message", "Please answer the verification question to prove ownership."));
        }

        ItemClaim claim = new ItemClaim(id, user.getUsername(), user.getDisplayName(), phone, answer, additionalProof);
        String proofImage = body != null ? body.get("proofImage") : null;
        if (proofImage != null && !proofImage.isBlank()) {
            claim.setProofImageData(proofImage.trim());
        }
        ItemClaim saved = claims.save(claim);

        // Notify report owner
        UserAccount owner = users.findByUsernameKey(report.getAccountUsername().toLowerCase(Locale.ROOT)).orElse(null);
        if (owner != null) {
            notificationService.notifyGeneral(
                    owner.getId(),
                    "CLAIM_SUBMITTED",
                    "New Ownership Claim! ✋",
                    "@" + user.getUsername() + " submitted proof of ownership for \"" + report.getTitle() + "\". Review and approve.",
                    user.getUsername(),
                    report.getId()
            );
        }

        return ResponseEntity.status(HttpStatus.CREATED).body(Map.of(
                "message", "Claim submitted successfully! The founder will review your answer.",
                "claimId", saved.getId()
        ));
    }

    @GetMapping("/reports/{id}/claims")
    public ResponseEntity<?> getClaimsForReport(@PathVariable Long id, HttpServletRequest request) {
        UserAccount user = requireLogin(request);
        Report report = reports.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Report not found."));

        boolean isOwner = user.getUsername().equalsIgnoreCase(report.getAccountUsername());
        boolean isPrivileged = List.of("OWNER", "ADMIN").contains(user.getRole());
        if (!isOwner && !isPrivileged) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only the founder can view submitted claims.");
        }

        List<ItemClaim> list = claims.findByReportIdOrderByCreatedAtDesc(id);
        return ResponseEntity.ok(list);
    }

    @PostMapping("/claims/{claimId}/approve")
    @Transactional
    public ResponseEntity<?> approveClaim(@PathVariable Long claimId, HttpServletRequest request) {
        UserAccount user = requireLogin(request);
        ItemClaim claim = claims.findById(claimId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Claim not found."));

        Report report = reports.findById(claim.getReportId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Report not found."));

        boolean isOwner = user.getUsername().equalsIgnoreCase(report.getAccountUsername());
        boolean isPrivileged = List.of("OWNER", "ADMIN").contains(user.getRole());
        if (!isOwner && !isPrivileged) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Not authorized.");
        }

        claim.setStatus("APPROVED");
        claims.save(claim);

        // Update report status to MATCHED
        report.setStatus("MATCHED");
        reports.save(report);

        // Award Karma Points to the founder (+50 Karma Points!)
        UserAccount founder = users.findByUsernameKey(report.getAccountUsername().toLowerCase(Locale.ROOT)).orElse(null);
        if (founder != null) {
            founder.setKarmaPoints(founder.getKarmaPoints() + 50);
            users.save(founder);
        }

        // Notify claimant
        UserAccount claimant = users.findByUsernameKey(claim.getClaimantUsername().toLowerCase(Locale.ROOT)).orElse(null);
        if (claimant != null) {
            notificationService.notifyGeneral(
                    claimant.getId(),
                    "CLAIM_APPROVED",
                    "Claim Approved! 🎉",
                    "Your proof of ownership for \"" + report.getTitle() + "\" was verified! Contact the founder to retrieve your item.",
                    user.getUsername(),
                    report.getId()
            );
        }

        return ResponseEntity.ok(Map.of(
                "message", "Claim approved! Item marked as Matched and 50 Good Samaritan Karma points awarded. 🎉",
                "status", "APPROVED"
        ));
    }

    @PostMapping("/claims/{claimId}/reject")
    @Transactional
    public ResponseEntity<?> rejectClaim(@PathVariable Long claimId, HttpServletRequest request) {
        UserAccount user = requireLogin(request);
        ItemClaim claim = claims.findById(claimId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Claim not found."));

        Report report = reports.findById(claim.getReportId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Report not found."));

        boolean isOwner = user.getUsername().equalsIgnoreCase(report.getAccountUsername());
        boolean isPrivileged = List.of("OWNER", "ADMIN").contains(user.getRole());
        if (!isOwner && !isPrivileged) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Not authorized.");
        }

        claim.setStatus("REJECTED");
        claims.save(claim);

        return ResponseEntity.ok(Map.of("message", "Claim rejected.", "status", "REJECTED"));
    }
}
