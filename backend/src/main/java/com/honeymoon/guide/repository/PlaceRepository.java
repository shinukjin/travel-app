package com.honeymoon.guide.repository;

import com.honeymoon.guide.domain.Place;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface PlaceRepository extends JpaRepository<Place, Long> {

    List<Place> findAllByOrderByNameAsc();
}
