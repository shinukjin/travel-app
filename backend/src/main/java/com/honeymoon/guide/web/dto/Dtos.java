package com.honeymoon.guide.web.dto;

import com.honeymoon.guide.domain.*;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;

public final class Dtos {

    private Dtos() {
    }

    public record TripRequest(
            @NotBlank String title,
            @NotBlank @Size(max = 128) String country,
            String destination,
            @NotNull LocalDate startDate,
            @NotNull LocalDate endDate
    ) {
    }

    public record TripSummary(
            Long id,
            String title,
            String country,
            String destination,
            LocalDate startDate,
            LocalDate endDate,
            int dayCount
    ) {
        public static TripSummary from(Trip trip) {
            int dayCount = (int) java.time.temporal.ChronoUnit.DAYS.between(
                    trip.getStartDate(), trip.getEndDate()) + 1;
            return new TripSummary(
                    trip.getId(),
                    trip.getTitle(),
                    trip.getCountry(),
                    trip.getDestination(),
                    trip.getStartDate(),
                    trip.getEndDate(),
                    dayCount
            );
        }
    }

    public record PlaceRequest(
            @NotBlank String name,
            @NotBlank String category,
            Double lat,
            Double lng,
            String address,
            String memo
    ) {
    }

    public record PlaceResponse(
            Long id,
            String name,
            String category,
            Double lat,
            Double lng,
            String address,
            String memo
    ) {
        public static PlaceResponse from(Place place) {
            return new PlaceResponse(
                    place.getId(),
                    place.getName(),
                    place.getCategory(),
                    place.getLat(),
                    place.getLng(),
                    place.getAddress(),
                    place.getMemo()
            );
        }
    }

    public record ScheduleItemRequest(
            @NotNull Long placeId,
            int sortOrder,
            LocalTime startTime,
            String note
    ) {
    }

    public record ScheduleItemResponse(
            Long id,
            int sortOrder,
            LocalTime startTime,
            String note,
            PlaceResponse place
    ) {
        public static ScheduleItemResponse from(ScheduleItem item) {
            return new ScheduleItemResponse(
                    item.getId(),
                    item.getSortOrder(),
                    item.getStartTime(),
                    item.getNote(),
                    PlaceResponse.from(item.getPlace())
            );
        }
    }

    public record ScheduleResponse(
            Long id,
            Long tripId,
            int dayIndex,
            LocalDate date,
            String title,
            List<ScheduleItemResponse> items
    ) {
        public static ScheduleResponse from(Schedule schedule) {
            return new ScheduleResponse(
                    schedule.getId(),
                    schedule.getTrip().getId(),
                    schedule.getDayIndex(),
                    schedule.getDate(),
                    schedule.getTitle(),
                    schedule.getItems().stream().map(ScheduleItemResponse::from).toList()
            );
        }
    }

    public record VoucherRequest(
            @NotNull Long tripId,
            @NotBlank String title,
            @NotBlank String type,
            @NotBlank String body
    ) {
    }

    public record VoucherResponse(
            Long id,
            Long tripId,
            String title,
            String type,
            String body
    ) {
        public static VoucherResponse from(Voucher voucher) {
            return new VoucherResponse(
                    voucher.getId(),
                    voucher.getTrip().getId(),
                    voucher.getTitle(),
                    voucher.getType(),
                    voucher.getBody()
            );
        }
    }

    public record PhraseRequest(
            @NotNull Long tripId,
            @NotBlank String situation,
            @NotBlank String ko,
            @NotBlank String localText,
            @NotBlank String locale
    ) {
    }

    public record PhraseResponse(
            Long id,
            Long tripId,
            String situation,
            String ko,
            String localText,
            String locale
    ) {
        public static PhraseResponse from(Phrase phrase) {
            return new PhraseResponse(
                    phrase.getId(),
                    phrase.getTrip().getId(),
                    phrase.getSituation(),
                    phrase.getKo(),
                    phrase.getLocalText(),
                    phrase.getLocale()
            );
        }
    }

    public record MemoRequest(
            @NotNull Long tripId,
            @NotBlank String content,
            String photoUri,
            Double lat,
            Double lng,
            LocalDateTime createdAt,
            @NotBlank String clientId
    ) {
    }

    public record MemoResponse(
            Long id,
            Long tripId,
            String content,
            String photoUri,
            Double lat,
            Double lng,
            LocalDateTime createdAt,
            String clientId
    ) {
        public static MemoResponse from(Memo memo) {
            return new MemoResponse(
                    memo.getId(),
                    memo.getTrip().getId(),
                    memo.getContent(),
                    memo.getPhotoUri(),
                    memo.getLat(),
                    memo.getLng(),
                    memo.getCreatedAt(),
                    memo.getClientId()
            );
        }
    }

    public record PackingItemRequest(
            @NotNull Long tripId,
            @NotBlank String name,
            @NotBlank String category,
            Integer quantity,
            String note,
            Boolean packed,
            Integer sortOrder
    ) {
    }

    public record PackingItemResponse(
            Long id,
            Long tripId,
            String name,
            String category,
            Integer quantity,
            String note,
            boolean packed,
            int sortOrder
    ) {
        public static PackingItemResponse from(PackingItem item) {
            return new PackingItemResponse(
                    item.getId(),
                    item.getTrip().getId(),
                    item.getName(),
                    item.getCategory(),
                    item.getQuantity(),
                    item.getNote(),
                    item.isPacked(),
                    item.getSortOrder()
            );
        }
    }

    public record MediaLogRequest(
            @NotNull Long tripId,
            @NotBlank String localUri,
            @NotBlank String mediaType,
            @NotNull LocalDateTime capturedAt,
            Double lat,
            Double lng
    ) {
    }

    public record MediaLogResponse(
            Long id,
            Long tripId,
            String localUri,
            String mediaType,
            LocalDateTime capturedAt,
            Double lat,
            Double lng
    ) {
        public static MediaLogResponse from(MediaLog log) {
            return new MediaLogResponse(
                    log.getId(),
                    log.getTrip().getId(),
                    log.getLocalUri(),
                    log.getMediaType(),
                    log.getCapturedAt(),
                    log.getLat(),
                    log.getLng()
            );
        }
    }
}
