package com.campus.lostfound;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "campus_market_listings")
public class MarketListing {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 150)
    private String title;

    @Column(nullable = false)
    private Double price = 0.0; // 0.0 means Free / Giveaway

    @Column(nullable = false, length = 50)
    private String category; // Books & Notes, Drafters, Lab Coats, Electronics, Hostel Essentials, Cycles, Other

    @Column(nullable = false, length = 30)
    private String condition = "GOOD"; // BRAND_NEW, LIKE_NEW, GOOD, FAIR

    @Column(length = 2000)
    private String description;

    @Column(length = 100)
    private String location; // e.g. Hostel 3, Block 2, Canteen

    @Column(length = 50)
    private String college = "CU";

    @Column(nullable = false, length = 50)
    private String sellerUsername;

    @Column(length = 100)
    private String sellerDisplayName;

    @Column(length = 30)
    private String sellerPhone;

    @Column(length = 30)
    private String sellerWhatsapp;

    @Column(columnDefinition = "text")
    private String imageData;

    @Column(nullable = false, length = 20)
    private String status = "AVAILABLE"; // AVAILABLE, SOLD

    private LocalDateTime createdAt = LocalDateTime.now();

    public MarketListing() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public Double getPrice() { return price == null ? 0.0 : price; }
    public void setPrice(Double price) { this.price = price; }
    public String getCategory() { return category == null ? "Other" : category; }
    public void setCategory(String category) { this.category = category; }
    public String getCondition() { return condition == null ? "GOOD" : condition; }
    public void setCondition(String condition) { this.condition = condition; }
    public String getDescription() { return description == null ? "" : description; }
    public void setDescription(String description) { this.description = description; }
    public String getLocation() { return location == null ? "" : location; }
    public void setLocation(String location) { this.location = location; }
    public String getCollege() { return college == null ? "CU" : college; }
    public void setCollege(String college) { this.college = college; }
    public String getSellerUsername() { return sellerUsername; }
    public void setSellerUsername(String sellerUsername) { this.sellerUsername = sellerUsername; }
    public String getSellerDisplayName() { return sellerDisplayName; }
    public void setSellerDisplayName(String sellerDisplayName) { this.sellerDisplayName = sellerDisplayName; }
    public String getSellerPhone() { return sellerPhone; }
    public void setSellerPhone(String sellerPhone) { this.sellerPhone = sellerPhone; }
    public String getSellerWhatsapp() { return sellerWhatsapp; }
    public void setSellerWhatsapp(String sellerWhatsapp) { this.sellerWhatsapp = sellerWhatsapp; }
    public String getImageData() { return imageData == null ? "" : imageData; }
    public void setImageData(String imageData) { this.imageData = imageData; }
    public String getPhotoDataUrl() { return getImageData(); }
    public void setPhotoDataUrl(String photoDataUrl) { setImageData(photoDataUrl); }
    public String getPhone() { return getSellerPhone(); }
    public void setPhone(String phone) { setSellerPhone(phone); }
    public String getSellerName() { return getSellerDisplayName(); }
    public void setSellerName(String name) { setSellerDisplayName(name); }
    public String getAccountUsername() { return getSellerUsername(); }
    public void setAccountUsername(String username) { setSellerUsername(username); }
    public boolean isSold() { return "SOLD".equalsIgnoreCase(status); }
    public String getStatus() { return status == null ? "AVAILABLE" : status; }
    public void setStatus(String status) { this.status = status; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
