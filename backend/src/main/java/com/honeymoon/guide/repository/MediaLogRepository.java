package com.honeymoon.guide.repository;

import com.honeymoon.guide.domain.MediaLog;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface MediaLogRepository extends JpaRepository<MediaLog, Long> {

    List<MediaLog> findByTripIdOrderByCapturedAtAsc(Long tripId);

    List<MediaLog> findAllByOrderByCapturedAtDesc();
}
