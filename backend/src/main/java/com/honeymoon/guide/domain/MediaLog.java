package com.honeymoon.guide.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

@Getter
@Setter
@Entity
@Table(name = "media_logs")
public class MediaLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "trip_id")
    private Trip trip;

    @Column(nullable = false, length = 2000)
    private String localUri;

    @Column(nullable = false, length = 16)
    private String mediaType;

    @Column(nullable = false)
    private LocalDateTime capturedAt;

    private Double lat;
    private Double lng;
}
