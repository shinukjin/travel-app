package com.honeymoon.guide.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Entity
@Table(name = "packing_items")
public class PackingItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "trip_id")
    private Trip trip;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false, length = 32)
    private String category;

    @Column(nullable = false)
    private Integer quantity = 1;

    @Column(length = 500)
    private String note;

    @Column(nullable = false)
    private boolean packed = false;

    @Column(nullable = false)
    private int sortOrder = 0;
}
