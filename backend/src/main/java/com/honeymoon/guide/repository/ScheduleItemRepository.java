package com.honeymoon.guide.repository;

import com.honeymoon.guide.domain.ScheduleItem;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ScheduleItemRepository extends JpaRepository<ScheduleItem, Long> {
}
