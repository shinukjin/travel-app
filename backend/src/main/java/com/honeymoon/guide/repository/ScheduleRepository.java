package com.honeymoon.guide.repository;

import com.honeymoon.guide.domain.Schedule;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface ScheduleRepository extends JpaRepository<Schedule, Long> {

    @EntityGraph(attributePaths = {"items", "items.place", "trip"})
    List<Schedule> findByTripIdOrderByDayIndexAsc(Long tripId);

    @EntityGraph(attributePaths = {"items", "items.place", "trip"})
    @Query("select s from Schedule s where s.id = :id")
    Optional<Schedule> findDetailedById(@Param("id") Long id);
}
