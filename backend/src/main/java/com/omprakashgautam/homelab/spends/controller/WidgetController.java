package com.omprakashgautam.homelab.spends.controller;

import com.omprakashgautam.homelab.spends.dto.WidgetDto;
import com.omprakashgautam.homelab.spends.security.UserDetailsImpl;
import com.omprakashgautam.homelab.spends.service.WidgetService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/widgets")
@RequiredArgsConstructor
public class WidgetController {

    private final WidgetService widgetService;

    @GetMapping
    public List<WidgetDto.WidgetResponse> getWidgets(
            @AuthenticationPrincipal UserDetailsImpl user) {
        return widgetService.getWidgets(user.getId());
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public WidgetDto.WidgetResponse createWidget(
            @AuthenticationPrincipal UserDetailsImpl user,
            @Valid @RequestBody WidgetDto.CreateRequest req) {
        return widgetService.createWidget(user.getId(), req);
    }

    @PutMapping("/{id}")
    public WidgetDto.WidgetResponse updateWidget(
            @PathVariable UUID id,
            @AuthenticationPrincipal UserDetailsImpl user,
            @Valid @RequestBody WidgetDto.UpdateRequest req) {
        return widgetService.updateWidget(id, user.getId(), req);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteWidget(
            @PathVariable UUID id,
            @AuthenticationPrincipal UserDetailsImpl user) {
        widgetService.deleteWidget(id, user.getId());
    }

    @PostMapping("/{id}/move")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void moveWidget(
            @PathVariable UUID id,
            @AuthenticationPrincipal UserDetailsImpl user,
            @Valid @RequestBody WidgetDto.MoveRequest req) {
        widgetService.moveWidget(id, user.getId(), req.position());
    }

    @GetMapping("/{id}/data")
    public WidgetDto.WidgetData getWidgetData(
            @PathVariable UUID id,
            @AuthenticationPrincipal UserDetailsImpl user) {
        return widgetService.getWidgetData(id, user.getId());
    }
}
