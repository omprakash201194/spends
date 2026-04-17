package com.omprakashgautam.homelab.spends.service;

import com.omprakashgautam.homelab.spends.dto.MerchantAliasDto;
import com.omprakashgautam.homelab.spends.model.MerchantAlias;
import com.omprakashgautam.homelab.spends.repository.MerchantAliasRepository;
import com.omprakashgautam.homelab.spends.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class MerchantAliasService {

    private final MerchantAliasRepository merchantAliasRepository;
    private final UserRepository userRepository;

    @Transactional(readOnly = true)
    public List<MerchantAliasDto.Response> list(UUID userId) {
        return merchantAliasRepository.findByUserId(userId).stream()
            .map(a -> new MerchantAliasDto.Response(a.getId(), a.getRawPattern(), a.getDisplayName()))
            .toList();
    }

    @Transactional
    public MerchantAliasDto.Response save(UUID userId, String rawPattern, String displayName) {
        MerchantAlias alias = merchantAliasRepository.findByUserIdAndRawPattern(userId, rawPattern)
            .orElse(MerchantAlias.builder()
                .user(userRepository.getReferenceById(userId))
                .rawPattern(rawPattern)
                .build());
        alias.setDisplayName(displayName);
        alias = merchantAliasRepository.save(alias);
        return new MerchantAliasDto.Response(alias.getId(), alias.getRawPattern(), alias.getDisplayName());
    }

    @Transactional
    public void delete(UUID id, UUID userId) {
        merchantAliasRepository.deleteByIdAndUserId(id, userId);
    }

    @Transactional(readOnly = true)
    public Map<String, String> getAliasMap(UUID userId) {
        return merchantAliasRepository.findByUserId(userId).stream()
            .collect(Collectors.toMap(MerchantAlias::getRawPattern, MerchantAlias::getDisplayName));
    }
}
