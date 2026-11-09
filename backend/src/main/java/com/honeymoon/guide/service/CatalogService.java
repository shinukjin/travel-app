package com.honeymoon.guide.service;

import com.honeymoon.guide.domain.*;
import com.honeymoon.guide.repository.*;
import com.honeymoon.guide.web.dto.Dtos.*;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class CatalogService {

    private final PlaceRepository placeRepository;
    private final VoucherRepository voucherRepository;
    private final PhraseRepository phraseRepository;
    private final PackingItemRepository packingItemRepository;
    private final MemoRepository memoRepository;
    private final MediaLogRepository mediaLogRepository;
    private final TripRepository tripRepository;

    public List<Place> places() {
        return placeRepository.findAllByOrderByNameAsc();
    }

    public Place getPlace(Long id) {
        return placeRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Place not found: " + id));
    }

    @Transactional
    public Place createPlace(PlaceRequest request) {
        return placeRepository.save(apply(new Place(), request));
    }

    @Transactional
    public Place updatePlace(Long id, PlaceRequest request) {
        return apply(getPlace(id), request);
    }

    @Transactional
    public void deletePlace(Long id) {
        placeRepository.delete(getPlace(id));
    }

    public List<VoucherResponse> vouchers(Long tripId) {
        List<Voucher> list = tripId == null ? voucherRepository.findAll() : voucherRepository.findByTripIdOrderByIdAsc(tripId);
        return list.stream().map(VoucherResponse::from).toList();
    }

    @Transactional
    public VoucherResponse createVoucher(VoucherRequest request) {
        Voucher voucher = new Voucher();
        apply(voucher, request);
        return VoucherResponse.from(voucherRepository.save(voucher));
    }

    @Transactional
    public VoucherResponse updateVoucher(Long id, VoucherRequest request) {
        Voucher voucher = voucherRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Voucher not found: " + id));
        apply(voucher, request);
        return VoucherResponse.from(voucher);
    }

    @Transactional
    public void deleteVoucher(Long id) {
        voucherRepository.delete(voucherRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Voucher not found: " + id)));
    }

    public List<PhraseResponse> phrases(Long tripId) {
        List<Phrase> list = tripId == null ? phraseRepository.findAll() : phraseRepository.findByTripIdOrderByIdAsc(tripId);
        return list.stream().map(PhraseResponse::from).toList();
    }

    @Transactional
    public PhraseResponse createPhrase(PhraseRequest request) {
        Phrase phrase = new Phrase();
        apply(phrase, request);
        return PhraseResponse.from(phraseRepository.save(phrase));
    }

    @Transactional
    public PhraseResponse updatePhrase(Long id, PhraseRequest request) {
        Phrase phrase = phraseRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Phrase not found: " + id));
        apply(phrase, request);
        return PhraseResponse.from(phrase);
    }

    @Transactional
    public void deletePhrase(Long id) {
        phraseRepository.delete(phraseRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Phrase not found: " + id)));
    }

    public List<PackingItemResponse> packingItems(Long tripId) {
        List<PackingItem> list = tripId == null
                ? packingItemRepository.findAllByOrderByCategoryAscSortOrderAscIdAsc()
                : packingItemRepository.findByTripIdOrderByCategoryAscSortOrderAscIdAsc(tripId);
        return list.stream().map(PackingItemResponse::from).toList();
    }

    @Transactional
    public PackingItemResponse createPackingItem(PackingItemRequest request) {
        PackingItem item = new PackingItem();
        apply(item, request);
        return PackingItemResponse.from(packingItemRepository.save(item));
    }

    @Transactional
    public PackingItemResponse updatePackingItem(Long id, PackingItemRequest request) {
        PackingItem item = packingItemRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Packing item not found: " + id));
        apply(item, request);
        return PackingItemResponse.from(item);
    }

    @Transactional
    public void deletePackingItem(Long id) {
        packingItemRepository.delete(packingItemRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Packing item not found: " + id)));
    }

    public List<MemoResponse> memos(Long tripId) {
        List<Memo> list = tripId == null ? memoRepository.findAllByOrderByCreatedAtDesc()
                : memoRepository.findByTripIdOrderByCreatedAtDesc(tripId);
        return list.stream().map(MemoResponse::from).toList();
    }

    @Transactional
    public MemoResponse upsertMemo(MemoRequest request) {
        Memo memo = memoRepository.findByClientId(request.clientId()).orElseGet(Memo::new);
        memo.setTrip(getTrip(request.tripId()));
        memo.setContent(request.content());
        memo.setPhotoUri(request.photoUri());
        memo.setLat(request.lat());
        memo.setLng(request.lng());
        memo.setCreatedAt(request.createdAt() == null ? LocalDateTime.now() : request.createdAt());
        memo.setClientId(request.clientId());
        return MemoResponse.from(memoRepository.save(memo));
    }

    public List<MediaLogResponse> mediaLogs(Long tripId) {
        List<MediaLog> list = tripId == null ? mediaLogRepository.findAllByOrderByCapturedAtDesc()
                : mediaLogRepository.findByTripIdOrderByCapturedAtAsc(tripId);
        return list.stream().map(MediaLogResponse::from).toList();
    }

    @Transactional
    public MediaLogResponse createMediaLog(MediaLogRequest request) {
        MediaLog log = new MediaLog();
        log.setTrip(getTrip(request.tripId()));
        log.setLocalUri(request.localUri());
        log.setMediaType(request.mediaType());
        log.setCapturedAt(request.capturedAt());
        log.setLat(request.lat());
        log.setLng(request.lng());
        return MediaLogResponse.from(mediaLogRepository.save(log));
    }

    private Trip getTrip(Long id) {
        return tripRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Trip not found: " + id));
    }

    private Place apply(Place place, PlaceRequest request) {
        place.setName(request.name());
        place.setCategory(request.category());
        place.setLat(request.lat());
        place.setLng(request.lng());
        place.setAddress(request.address());
        place.setMemo(request.memo());
        return place;
    }

    private void apply(Voucher voucher, VoucherRequest request) {
        voucher.setTrip(getTrip(request.tripId()));
        voucher.setTitle(request.title());
        voucher.setType(request.type());
        voucher.setBody(request.body());
    }

    private void apply(Phrase phrase, PhraseRequest request) {
        phrase.setTrip(getTrip(request.tripId()));
        phrase.setSituation(request.situation());
        phrase.setKo(request.ko());
        phrase.setLocalText(request.localText());
        phrase.setLocale(request.locale());
    }

    private void apply(PackingItem item, PackingItemRequest request) {
        item.setTrip(getTrip(request.tripId()));
        item.setName(request.name());
        item.setCategory(request.category());
        item.setQuantity(request.quantity() == null || request.quantity() < 1 ? 1 : request.quantity());
        item.setNote(request.note());
        item.setPacked(Boolean.TRUE.equals(request.packed()));
        item.setSortOrder(request.sortOrder() == null ? 0 : request.sortOrder());
    }
}
