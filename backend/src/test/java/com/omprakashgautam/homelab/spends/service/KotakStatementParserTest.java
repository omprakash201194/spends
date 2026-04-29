package com.omprakashgautam.homelab.spends.service;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;

import java.nio.charset.StandardCharsets;

import static org.assertj.core.api.Assertions.assertThat;

class KotakStatementParserTest {

    private final KotakStatementParser parser = new KotakStatementParser();

    /** Inline fixture covering metadata, multi-line wrap, opening balance, and a page footer. */
    private static final String SAMPLE_CSV =
            "Account Statement,,,,,,\n" +
            "03 Jan 2026 - 29 Apr 2026,,,,,,\n" +
            "Omprakash Harishchandra Gautam,,,,Account No. 4550925349,,\n" +
            ",,,,Account Type Savings,,\n" +
            "MICR 411485055,IFSC Code KKBK0001819,,,,,\n" +
            ",,Savings Account Transactions,,,,\n" +
            "#,Date,Description,Chq/Ref. No.,Withdrawal (Dr.),Deposit (Cr.),Balance\n" +
            "-,-,Opening Balance,-,-,-,0\n" +
            "1,03 Jan 2026,KOTAK811/665749423572,,,50000,50000\n" +
            "2,03 Jan 2026,UPI/OMPRAKASH HARIS/600318766885/Early,UPI-600381736737,4000,,46000\n" +
            ",,Jan spend,,,,\n" +
            "\"Statement Generated on 29 Apr 2026, 03:21\",,,,,,Page 1 of 6\n" +
            "3,04 Jan 2026,REV-UPI/KAVITA,UPI-600422171528,,3000,49000\n" +
            "Account Summary,,,,,,\n" +
            "Particulars,Opening Balance,Closing Balance,,,,\n";

    @Test
    void parse_extractsAccountHolderName() throws Exception {
        MockMultipartFile file = csv("statement.csv", SAMPLE_CSV);
        ParsedStatement result = parser.parse(file);
        assertThat(result.accountHolderName()).isEqualTo("Omprakash Harishchandra Gautam");
    }

    private MockMultipartFile csv(String filename, String content) {
        return new MockMultipartFile("files", filename, "text/csv",
                content.getBytes(StandardCharsets.UTF_8));
    }
}
