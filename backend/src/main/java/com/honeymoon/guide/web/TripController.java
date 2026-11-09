package com.honeymoon.guide.web;

import com.honeymoon.guide.service.TripService;
import com.honeymoon.guide.web.dto.Dtos.ScheduleItemRequest;
import com.honeymoon.guide.web.dto.Dtos.ScheduleResponse;
import com.honeymoon.guide.web.dto.Dtos.TripRequest;
import com.honeymoon.guide.web.dto.Dtos.TripSummary;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api")
public class TripController {

    private final TripService tripService;

    @GetMapping("/trips")
    public List<TripSummary> list() {
        return tripService.findAll().stream().map(TripSummary::from).toList();
    }

    @GetMapping("/trips/{id}")
    public TripSummary get(@PathVariable Long id) {
        return TripSummary.from(tripService.get(id));
    }

    @PostMapping("/trips")
    @ResponseStatus(HttpStatus.CREATED)
    public TripSummary create(@Valid @RequestBody TripRequest request) {
        return TripSummary.from(tripService.create(request));
    }

    @PutMapping("/trips/{id}")
    public TripSummary update(@PathVariable Long id, @Valid @RequestBody TripRequest request) {
        return TripSummary.from(tripService.update(id, request));
    }

    @DeleteMapping("/trips/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id) {
        tripService.delete(id);
    }

    @GetMapping("/trips/{id}/schedules")
    public List<ScheduleResponse> schedules(@PathVariable Long id) {
        return tripService.findSchedules(id).stream().map(ScheduleResponse::from).toList();
    }

    @PutMapping("/schedules/{id}/items")
    public ScheduleResponse replaceItems(
            @PathVariable Long id,
            @Valid @RequestBody List<ScheduleItemRequest> items
    ) {
        return ScheduleResponse.from(tripService.replaceItems(id, items));
    }
}
