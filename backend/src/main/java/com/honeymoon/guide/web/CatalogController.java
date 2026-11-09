package com.honeymoon.guide.web;

import com.honeymoon.guide.service.CatalogService;
import com.honeymoon.guide.web.dto.Dtos.*;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api")
public class CatalogController {

    private final CatalogService catalogService;

    @GetMapping("/places")
    public List<PlaceResponse> places() {
        return catalogService.places().stream().map(PlaceResponse::from).toList();
    }

    @PostMapping("/places")
    @ResponseStatus(HttpStatus.CREATED)
    public PlaceResponse createPlace(@Valid @RequestBody PlaceRequest request) {
        return PlaceResponse.from(catalogService.createPlace(request));
    }

    @PutMapping("/places/{id}")
    public PlaceResponse updatePlace(@PathVariable Long id, @Valid @RequestBody PlaceRequest request) {
        return PlaceResponse.from(catalogService.updatePlace(id, request));
    }

    @DeleteMapping("/places/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deletePlace(@PathVariable Long id) {
        catalogService.deletePlace(id);
    }

    @GetMapping("/vouchers")
    public List<VoucherResponse> vouchers(@RequestParam(required = false) Long tripId) {
        return catalogService.vouchers(tripId);
    }

    @PostMapping("/vouchers")
    @ResponseStatus(HttpStatus.CREATED)
    public VoucherResponse createVoucher(@Valid @RequestBody VoucherRequest request) {
        return catalogService.createVoucher(request);
    }

    @PutMapping("/vouchers/{id}")
    public VoucherResponse updateVoucher(@PathVariable Long id, @Valid @RequestBody VoucherRequest request) {
        return catalogService.updateVoucher(id, request);
    }

    @DeleteMapping("/vouchers/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteVoucher(@PathVariable Long id) {
        catalogService.deleteVoucher(id);
    }

    @GetMapping("/phrases")
    public List<PhraseResponse> phrases(@RequestParam(required = false) Long tripId) {
        return catalogService.phrases(tripId);
    }

    @PostMapping("/phrases")
    @ResponseStatus(HttpStatus.CREATED)
    public PhraseResponse createPhrase(@Valid @RequestBody PhraseRequest request) {
        return catalogService.createPhrase(request);
    }

    @PutMapping("/phrases/{id}")
    public PhraseResponse updatePhrase(@PathVariable Long id, @Valid @RequestBody PhraseRequest request) {
        return catalogService.updatePhrase(id, request);
    }

    @DeleteMapping("/phrases/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deletePhrase(@PathVariable Long id) {
        catalogService.deletePhrase(id);
    }

    @GetMapping("/packing-items")
    public List<PackingItemResponse> packingItems(@RequestParam(required = false) Long tripId) {
        return catalogService.packingItems(tripId);
    }

    @PostMapping("/packing-items")
    @ResponseStatus(HttpStatus.CREATED)
    public PackingItemResponse createPackingItem(@Valid @RequestBody PackingItemRequest request) {
        return catalogService.createPackingItem(request);
    }

    @PutMapping("/packing-items/{id}")
    public PackingItemResponse updatePackingItem(@PathVariable Long id, @Valid @RequestBody PackingItemRequest request) {
        return catalogService.updatePackingItem(id, request);
    }

    @DeleteMapping("/packing-items/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deletePackingItem(@PathVariable Long id) {
        catalogService.deletePackingItem(id);
    }

    @GetMapping("/memos")
    public List<MemoResponse> memos(@RequestParam(required = false) Long tripId) {
        return catalogService.memos(tripId);
    }

    @PostMapping("/memos")
    @ResponseStatus(HttpStatus.CREATED)
    public MemoResponse upsertMemo(@Valid @RequestBody MemoRequest request) {
        return catalogService.upsertMemo(request);
    }

    @GetMapping("/media-logs")
    public List<MediaLogResponse> mediaLogs(@RequestParam(required = false) Long tripId) {
        return catalogService.mediaLogs(tripId);
    }

    @PostMapping("/media-logs")
    @ResponseStatus(HttpStatus.CREATED)
    public MediaLogResponse createMediaLog(@Valid @RequestBody MediaLogRequest request) {
        return catalogService.createMediaLog(request);
    }
}
