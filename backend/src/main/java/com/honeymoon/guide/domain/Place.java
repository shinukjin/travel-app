package com.honeymoon.guide.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Entity
@Table(name = "places")
public class Place {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false, length = 32)
    private String category;

    private Double lat;
    private Double lng;
    private String address;

    @Column(length = 2000)
    private String memo;
}
