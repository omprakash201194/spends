package com.omprakashgautam.homelab.spends.service;

import com.omprakashgautam.homelab.spends.dto.TagDto;
import com.omprakashgautam.homelab.spends.repository.TransactionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

@Service
@RequiredArgsConstructor
public class TagService {

    private final TransactionRepository transactionRepository;


    @Transactional(readOnly = true)
    public List<TagDto.TagEntry> getTagsForUser(UUID userId) {
        List<String> remarks = transactionRepository.findDistinctRawRemarks(userId);

        Map<String, Long> counts = new LinkedHashMap<>();
        for (String remark : remarks) {
            if (remark == null) continue;
            Set<String> seen = new HashSet<>(); // count each tag once per remark
            for (String part : remark.split("[/\\s@_\\-|:]+")) {
                String tag = part.toLowerCase().trim();
                if (isNoise(tag) || seen.contains(tag)) continue;
                seen.add(tag);
                counts.merge(tag, 1L, Long::sum);
            }
        }

        return counts.entrySet().stream()
                .filter(e -> e.getValue() > 1)
                .sorted(Map.Entry.<String, Long>comparingByValue().reversed())
                .limit(100)
                .map(e -> new TagDto.TagEntry(e.getKey(), e.getValue()))
                .toList();
    }

    private boolean isNoise(String tag) {
        if (tag.length() < 2) return true;
        if (tag.matches("\\d+")) return true;
        if (tag.matches("[a-f0-9]{8,}")) return true;
        if (tag.matches(".*\\d{6,}.*")) return true;
        return false;
    }
}
