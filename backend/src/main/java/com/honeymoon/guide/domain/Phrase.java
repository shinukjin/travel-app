package com.honeymoon.guide.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Entity
@Table(name = "phrases")
public class Phrase {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "trip_id")
    private Trip trip;

    @Column(nullable = false)
    private String situation;

    @Column(nullable = false)
    private String ko;

    @Column(nullable = false)
    private String localText;

    @Column(nullable = false, length = 16)
    private String locale;
}
