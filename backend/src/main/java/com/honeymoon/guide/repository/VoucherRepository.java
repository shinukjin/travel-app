package com.honeymoon.guide.repository;

import com.honeymoon.guide.domain.Voucher;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface VoucherRepository extends JpaRepository<Voucher, Long> {

    List<Voucher> findByTripIdOrderByIdAsc(Long tripId);
}
