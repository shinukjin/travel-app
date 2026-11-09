package com.honeymoon.guide.config;

import com.honeymoon.guide.domain.*;
import com.honeymoon.guide.repository.PackingItemRepository;
import com.honeymoon.guide.repository.PlaceRepository;
import com.honeymoon.guide.repository.TripRepository;
import com.honeymoon.guide.service.TripService;
import com.honeymoon.guide.web.dto.Dtos.ScheduleItemRequest;
import com.honeymoon.guide.web.dto.Dtos.TripRequest;
import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

@Component
@RequiredArgsConstructor
public class DataSeeder implements CommandLineRunner {

    private final TripRepository tripRepository;
    private final PlaceRepository placeRepository;
    private final PackingItemRepository packingItemRepository;
    private final TripService tripService;
    private final EntityManager entityManager;

    @Override
    @Transactional
    public void run(String... args) {
        widenCountryColumn();
        if (tripRepository.count() > 0) {
            tripRepository.findAll().forEach((trip) -> {
                if (trip.getDestination() == null || trip.getDestination().isBlank()) {
                    if ("PT".equals(trip.getCountry())) trip.setDestination("리스본");
                    else if ("ES".equals(trip.getCountry())) trip.setDestination("바르셀로나");
                }
                if (trip.getPackingItems().isEmpty()) seedPacking(trip);
            });
            return;
        }

        Place sagrada = place("사그라다 파밀리아", "SIGHT", 41.4036, 2.1744, "Carrer de Mallorca, 401, Barcelona", " Gaudí 성당. 사전 예약 필수.");
        Place parkGuell = place("구엘 공원", "SIGHT", 41.4145, 2.1527, "08024 Barcelona", "모자이크 도마뱀 포토존.");
        Place boqueria = place("라 보케리아 시장", "FOOD", 41.3816, 2.1715, "La Rambla, 91, Barcelona", "하몽·주스 스탠드.");
        Place hotelEs = place("호텔 카사 푸스테르", "STAY", 41.3990, 2.1580, "Passeig de Gràcia, 132", "그라시아 지구 체크인.");
        Place belem = place("벨렘탑", "SIGHT", 38.6916, -9.2160, "Av. Brasília, Lisboa", "테주 강변 일몰.");
        Place pasteis = place("파스테이스 드 벨렘", "FOOD", 38.6976, -9.2034, "R. de Belém 84-92, Lisboa", "에그타르트 오리지널.");
        Place alfama = place("알파마 지구", "SIGHT", 38.7126, -9.1309, "Alfama, Lisboa", "골목 산책과 파두.");
        Place hotelPt = place("리스본 호텔 브리타니아", "STAY", 38.7322, -9.1469, "Rua Rodrigues Sampaio 17", "아르데코 호텔.");

        Trip spain = tripService.create(new TripRequest(
                "스페인 신혼여행", "ES", "바르셀로나",
                LocalDate.of(2026, 10, 1), LocalDate.of(2026, 10, 7)
        ));
        Trip portugal = tripService.create(new TripRequest(
                "포르투갈 신혼여행", "PT", "리스본",
                LocalDate.of(2026, 10, 8), LocalDate.of(2026, 10, 12)
        ));

        List<Schedule> spainDays = tripService.findSchedules(spain.getId());
        tripService.replaceItems(spainDays.get(0).getId(), List.of(
                item(hotelEs.getId(), 0, LocalTime.of(14, 0), "체크인"),
                item(sagrada.getId(), 1, LocalTime.of(16, 30), "예약 입장"),
                item(boqueria.getId(), 2, LocalTime.of(19, 30), "가벼운 저녁")
        ));
        tripService.replaceItems(spainDays.get(1).getId(), List.of(
                item(parkGuell.getId(), 0, LocalTime.of(10, 0), "오전 산책")
        ));

        List<Schedule> ptDays = tripService.findSchedules(portugal.getId());
        tripService.replaceItems(ptDays.get(0).getId(), List.of(
                item(hotelPt.getId(), 0, LocalTime.of(15, 0), "체크인"),
                item(alfama.getId(), 1, LocalTime.of(17, 0), "골목 산책")
        ));
        tripService.replaceItems(ptDays.get(1).getId(), List.of(
                item(belem.getId(), 0, LocalTime.of(10, 0), "벨렘 지구"),
                item(pasteis.getId(), 1, LocalTime.of(11, 30), "에그타르트")
        ));

        voucher(spain, "KE917 인천 → 바르셀로나", "FLIGHT", "10/01 KE917 ICN 10:20 → BCN 17:10\n좌석 12A / 12B\nPNR: ABC123");
        voucher(spain, "호텔 카사 푸스테르", "HOTEL", "10/01–10/07 Deluxe Room\n확인번호: CF-8821\n조식 포함");
        voucher(portugal, "TP1234 바르셀로나 → 리스본", "FLIGHT", "10/08 TP1234 BCN 09:15 → LIS 10:05\n좌석 8A / 8B");
        voucher(portugal, "호텔 브리타니아", "HOTEL", "10/08–10/12 Classic Room\n확인번호: HB-4410");

        phrase(spain, "택시 타기", "이 주소로 가 주세요.", "Vaya a esta dirección, por favor.", "es-ES");
        phrase(spain, "계산", "계산해 주세요.", "La cuenta, por favor.", "es-ES");
        phrase(spain, "알레르기", "해산물에 알레르기가 있어요.", "Tengo alergia al marisco.", "es-ES");
        phrase(portugal, "길 묻기", "이 곳 어떻게 가나요?", "Como chego a este sítio?", "pt-PT");
        phrase(portugal, "주문", "이거 주세요.", "Queria isto, por favor.", "pt-PT");
        phrase(portugal, "감사", "정말 고마워요.", "Muito obrigado.", "pt-PT");
        seedPacking(spain);
        seedPacking(portugal);
    }

    private void widenCountryColumn() {
        try {
            entityManager.createNativeQuery("ALTER TABLE TRIPS ALTER COLUMN COUNTRY SET DATA TYPE VARCHAR(128)").executeUpdate();
        } catch (Exception ignored) {
            // 신규 스키마이거나 이미 확장된 경우
        }
    }

    private Place place(String name, String category, double lat, double lng, String address, String memo) {
        Place place = new Place();
        place.setName(name);
        place.setCategory(category);
        place.setLat(lat);
        place.setLng(lng);
        place.setAddress(address);
        place.setMemo(memo);
        return placeRepository.save(place);
    }

    private ScheduleItemRequest item(Long placeId, int order, LocalTime time, String note) {
        return new ScheduleItemRequest(placeId, order, time, note);
    }

    private void voucher(Trip trip, String title, String type, String body) {
        Voucher voucher = new Voucher();
        voucher.setTrip(trip);
        voucher.setTitle(title);
        voucher.setType(type);
        voucher.setBody(body);
        trip.getVouchers().add(voucher);
    }

    private void seedPacking(Trip trip) {
        packing(trip, "여권", "DOCS", 1, "유효기간 6개월 이상", 0);
        packing(trip, "항공 모바일 보딩패스", "DOCS", 1, "", 1);
        packing(trip, "충전기·보조배터리", "GEAR", 1, "기내 휴대", 2);
        packing(trip, "멀티 어댑터", "GEAR", 1, "C타입", 3);
        packing(trip, "편한 신발", "CLOTHES", 1, "", 4);
        packing(trip, "상비약·밴드", "MEDICINE", 1, "", 5);
        packing(trip, "선크림", "TOILETRY", 1, "", 6);
        packing(trip, "선글라스", "OTHER", 1, "", 7);
    }

    private void packing(Trip trip, String name, String category, int quantity, String note, int sortOrder) {
        PackingItem item = new PackingItem();
        item.setTrip(trip);
        item.setName(name);
        item.setCategory(category);
        item.setQuantity(quantity);
        item.setNote(note);
        item.setPacked(false);
        item.setSortOrder(sortOrder);
        packingItemRepository.save(item);
    }

    private void phrase(Trip trip, String situation, String ko, String localText, String locale) {
        Phrase phrase = new Phrase();
        phrase.setTrip(trip);
        phrase.setSituation(situation);
        phrase.setKo(ko);
        phrase.setLocalText(localText);
        phrase.setLocale(locale);
        trip.getPhrases().add(phrase);
    }
}
