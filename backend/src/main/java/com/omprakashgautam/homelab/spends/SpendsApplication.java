package com.omprakashgautam.homelab.spends;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class SpendsApplication {
    public static void main(String[] args) {
        SpringApplication.run(SpendsApplication.class, args);
    }
}
