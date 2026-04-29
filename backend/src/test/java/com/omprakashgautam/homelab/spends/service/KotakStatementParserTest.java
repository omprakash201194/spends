package com.omprakashgautam.homelab.spends.service;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

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

    @Test
    void parse_masksAccountNumber() throws Exception {
        MockMultipartFile file = csv("statement.csv", SAMPLE_CSV);
        ParsedStatement result = parser.parse(file);
        assertThat(result.accountNumberMasked()).isEqualTo("455XXXX349");
    }

    @Test
    void parse_setsBankNameAndAccountType() throws Exception {
        MockMultipartFile file = csv("statement.csv", SAMPLE_CSV);
        ParsedStatement result = parser.parse(file);
        assertThat(result.bankName()).isEqualTo("Kotak Mahindra Bank");
        assertThat(result.accountType()).isEqualTo("Savings");
    }

    @Test
    void parse_throwsWhenNoHeaderRowFound() {
        String badCsv = "some,random,data\nno,header,here\n";
        MockMultipartFile file = csv("bad.csv", badCsv);
        assertThatThrownBy(() -> parser.parse(file))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("Could not find transaction header row");
    }

    @Test
    void parse_singleWithdrawalRow() throws Exception {
        MockMultipartFile file = csv("statement.csv", SAMPLE_CSV);
        ParsedStatement result = parser.parse(file);

        // Row "2" in fixture: 4000 withdrawal on 03 Jan 2026, balance 46000.
        // After multi-line merge (Task 4) rawRemarks will gain " Jan spend";
        // for now we assert the prefix.
        ParsedStatement.ParsedTransaction tx = result.transactions().stream()
                .filter(t -> t.withdrawalAmount().compareTo(new BigDecimal("4000")) == 0)
                .findFirst().orElseThrow();
        assertThat(tx.transactionDate()).isEqualTo(LocalDate.of(2026, 1, 3));
        assertThat(tx.valueDate()).isEqualTo(LocalDate.of(2026, 1, 3));
        assertThat(tx.depositAmount()).isEqualByComparingTo(BigDecimal.ZERO);
        assertThat(tx.balance()).isEqualByComparingTo(new BigDecimal("46000"));
        assertThat(tx.chequeNumber()).isEqualTo("UPI-600381736737");
        assertThat(tx.rawRemarks()).startsWith("UPI/OMPRAKASH HARIS/600318766885/Early");
    }

    @Test
    void parse_singleDepositRow() throws Exception {
        MockMultipartFile file = csv("statement.csv", SAMPLE_CSV);
        ParsedStatement result = parser.parse(file);

        // Row "1" in fixture: 50000 deposit on 03 Jan 2026, balance 50000.
        ParsedStatement.ParsedTransaction tx = result.transactions().stream()
                .filter(t -> t.depositAmount().compareTo(new BigDecimal("50000")) == 0
                          && t.balance().compareTo(new BigDecimal("50000")) == 0)
                .findFirst().orElseThrow();
        assertThat(tx.transactionDate()).isEqualTo(LocalDate.of(2026, 1, 3));
        assertThat(tx.withdrawalAmount()).isEqualByComparingTo(BigDecimal.ZERO);
        assertThat(tx.rawRemarks()).isEqualTo("KOTAK811/665749423572");
        assertThat(tx.chequeNumber()).isNull();
    }

    @Test
    void parse_mergesContinuationRow() throws Exception {
        MockMultipartFile file = csv("statement.csv", SAMPLE_CSV);
        ParsedStatement result = parser.parse(file);

        // Row "2" + continuation row -> "UPI/OMPRAKASH HARIS/600318766885/Early Jan spend"
        ParsedStatement.ParsedTransaction tx = result.transactions().stream()
                .filter(t -> t.withdrawalAmount().compareTo(new BigDecimal("4000")) == 0)
                .findFirst().orElseThrow();
        assertThat(tx.rawRemarks())
                .isEqualTo("UPI/OMPRAKASH HARIS/600318766885/Early Jan spend");
    }

    private MockMultipartFile csv(String filename, String content) {
        return new MockMultipartFile("files", filename, "text/csv",
                content.getBytes(StandardCharsets.UTF_8));
    }
}
