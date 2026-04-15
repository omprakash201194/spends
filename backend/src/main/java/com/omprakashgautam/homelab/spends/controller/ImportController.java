package com.omprakashgautam.homelab.spends.controller;

import com.omprakashgautam.homelab.spends.dto.ImportResultDto;
import com.omprakashgautam.homelab.spends.security.UserDetailsImpl;
import com.omprakashgautam.homelab.spends.service.ImportService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequestMapping("/api/import")
@RequiredArgsConstructor
public class ImportController {

    private final ImportService importService;

    /**
     * Upload one or more ICICI bank statement XLS/XLSX files.
     * Returns a summary of imported, duplicate, and error counts.
     */
    @PostMapping(value = "/icici", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ImportResultDto.Response> importIcici(
            @AuthenticationPrincipal UserDetailsImpl principal,
            @RequestPart("files") List<MultipartFile> files) {

        if (files == null || files.isEmpty()) {
            return ResponseEntity.badRequest().build();
        }

        ImportResultDto.Response result = importService.importFiles(principal.getId(), files);
        return ResponseEntity.ok(result);
    }
}
