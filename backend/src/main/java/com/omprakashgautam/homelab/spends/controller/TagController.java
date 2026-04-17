package com.omprakashgautam.homelab.spends.controller;

import com.omprakashgautam.homelab.spends.dto.TagDto;
import com.omprakashgautam.homelab.spends.security.UserDetailsImpl;
import com.omprakashgautam.homelab.spends.service.TagService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/transactions/tags")
@RequiredArgsConstructor
public class TagController {

    private final TagService tagService;

    @GetMapping
    public ResponseEntity<TagDto.TagsResponse> getTags(
            @AuthenticationPrincipal UserDetailsImpl principal) {
        return ResponseEntity.ok(
                new TagDto.TagsResponse(tagService.getTagsForUser(principal.getId())));
    }
}
