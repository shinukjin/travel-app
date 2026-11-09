package com.honeymoon.guide.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

@Getter
@Setter
@Entity
@Table(name = "memos")
public class Memo {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "trip_id")
    private Trip trip;

    @Column(nullable = false, length = 4000)
    private String content;

    private String photoUri;
    private Double lat;
    private Double lng;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    @Column(nullable = false, unique = true, length = 64)
    private String clientId;
}
