package com.honeymoon.guide.service;

import com.honeymoon.guide.domain.Place;
import com.honeymoon.guide.domain.Schedule;
import com.honeymoon.guide.domain.ScheduleItem;
import com.honeymoon.guide.domain.Trip;
import com.honeymoon.guide.repository.PlaceRepository;
import com.honeymoon.guide.repository.ScheduleRepository;
import com.honeymoon.guide.repository.TripRepository;
import com.honeymoon.guide.web.dto.Dtos.ScheduleItemRequest;
import com.honeymoon.guide.web.dto.Dtos.TripRequest;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class TripService {

    private final TripRepository tripRepository;
    private final ScheduleRepository scheduleRepository;
    private final PlaceRepository placeRepository;

    public List<Trip> findAll() {
        return tripRepository.findAllByOrderByStartDateAsc();
    }

    public Trip get(Long id) {
        return tripRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Trip not found: " + id));
    }

    public List<Schedule> findSchedules(Long tripId) {
        get(tripId);
        return scheduleRepository.findByTripIdOrderByDayIndexAsc(tripId);
    }

    public Schedule getSchedule(Long scheduleId) {
        return scheduleRepository.findDetailedById(scheduleId)
                .orElseThrow(() -> new EntityNotFoundException("Schedule not found: " + scheduleId));
    }

    @Transactional
    public Trip create(TripRequest request) {
        validateDates(request);
        Trip trip = new Trip();
        apply(trip, request);
        regenerateSchedules(trip);
        return tripRepository.save(trip);
    }

    @Transactional
    public Trip update(Long id, TripRequest request) {
        validateDates(request);
        Trip trip = get(id);
        apply(trip, request);
        regenerateSchedules(trip);
        return trip;
    }

    @Transactional
    public void delete(Long id) {
        tripRepository.delete(get(id));
    }

    @Transactional
    public Schedule replaceItems(Long scheduleId, List<ScheduleItemRequest> requests) {
        Schedule schedule = getSchedule(scheduleId);
        schedule.getItems().clear();
        int order = 0;
        for (ScheduleItemRequest request : requests) {
            Place place = placeRepository.findById(request.placeId())
                    .orElseThrow(() -> new EntityNotFoundException("Place not found: " + request.placeId()));
            ScheduleItem item = new ScheduleItem();
            item.setSchedule(schedule);
            item.setPlace(place);
            item.setSortOrder(request.sortOrder() > 0 ? request.sortOrder() : order);
            item.setStartTime(request.startTime());
            item.setNote(request.note());
            schedule.getItems().add(item);
            order++;
        }
        return schedule;
    }

    private void apply(Trip trip, TripRequest request) {
        trip.setTitle(request.title());
        trip.setCountry(normalizeCountries(request.country()));
        trip.setDestination(request.destination() == null ? null : request.destination().trim());
        trip.setStartDate(request.startDate());
        trip.setEndDate(request.endDate());
    }

    private String normalizeCountries(String raw) {
        LinkedHashSet<String> codes = Arrays.stream(String.valueOf(raw).split("[,/|;]+"))
                .map(String::trim)
                .map(String::toUpperCase)
                .filter((code) -> code.matches("[A-Z]{2}"))
                .collect(Collectors.toCollection(LinkedHashSet::new));
        if (codes.isEmpty()) {
            throw new IllegalArgumentException("국가를 하나 이상 선택하세요.");
        }
        return String.join(",", codes);
    }

    private void validateDates(TripRequest request) {
        if (request.endDate().isBefore(request.startDate())) {
            throw new IllegalArgumentException("종료일은 시작일 이후여야 합니다.");
        }
    }

    private void regenerateSchedules(Trip trip) {
        Map<LocalDate, Schedule> byDate = trip.getSchedules().stream()
                .collect(Collectors.toMap(Schedule::getDate, Function.identity(), (a, b) -> a));

        List<LocalDate> desired = new ArrayList<>();
        long days = ChronoUnit.DAYS.between(trip.getStartDate(), trip.getEndDate()) + 1;
        for (int i = 0; i < days; i++) {
            desired.add(trip.getStartDate().plusDays(i));
        }

        trip.getSchedules().removeIf(schedule -> !desired.contains(schedule.getDate()));

        int index = 1;
        for (LocalDate date : desired) {
            Schedule schedule = byDate.get(date);
            if (schedule == null) {
                schedule = new Schedule();
                schedule.setTrip(trip);
                schedule.setDate(date);
                trip.getSchedules().add(schedule);
            }
            schedule.setDayIndex(index);
            if (schedule.getTitle() == null || schedule.getTitle().isBlank()) {
                schedule.setTitle(index + "일차");
            }
            index++;
        }
        trip.getSchedules().sort(Comparator.comparingInt(Schedule::getDayIndex));
    }
}
