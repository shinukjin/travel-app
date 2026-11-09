package com.honeymoon.guide.repository;

import com.honeymoon.guide.domain.Phrase;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface PhraseRepository extends JpaRepository<Phrase, Long> {

    List<Phrase> findByTripIdOrderByIdAsc(Long tripId);
}
