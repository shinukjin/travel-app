package com.honeymoon.guide.repository;

import com.honeymoon.guide.domain.Memo;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface MemoRepository extends JpaRepository<Memo, Long> {

    List<Memo> findByTripIdOrderByCreatedAtDesc(Long tripId);

    List<Memo> findAllByOrderByCreatedAtDesc();

    Optional<Memo> findByClientId(String clientId);
}
