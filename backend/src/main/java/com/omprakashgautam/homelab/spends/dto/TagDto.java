package com.omprakashgautam.homelab.spends.dto;

import java.util.List;

public class TagDto {
    public record TagEntry(String tag, long count) {}
    public record TagsResponse(List<TagEntry> tags) {}
}
