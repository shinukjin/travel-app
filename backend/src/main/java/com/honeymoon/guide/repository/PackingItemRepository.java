package com.honeymoon.guide.repository;

import com.honeymoon.guide.domain.PackingItem;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface PackingItemRepository extends JpaRepository<PackingItem, Long> {

    List<PackingItem> findAllByOrderByCategoryAscSortOrderAscIdAsc();

    List<PackingItem> findByTripIdOrderByCategoryAscSortOrderAscIdAsc(Long tripId);
}
