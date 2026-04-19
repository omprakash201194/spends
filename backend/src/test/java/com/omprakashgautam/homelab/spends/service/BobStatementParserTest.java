package com.omprakashgautam.homelab.spends.service;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class BobStatementParserTest {

    private final BobStatementParser parser = new BobStatementParser();

    private static final String SAMPLE_CSV =
            ",Main Account  Holder Name  :OMPRAKASH GAUTAM,,,,,,,,Address : ,,,,,,\n" +
            "Customer Id:,,,065937386,,,,,,,Account No:,,,368XXXXXXXX803,,\n" +
            "Branch Name:,,,\"MANPADA ROAD, DOMBIVALI (EAST)\",,,,,,,MICR Code:,,,400012167,,\n" +
            "IFSC Code:,,,BARB0MANPAD,,,,,,,Nominee Reg:,,,Yes,,\n" +
            "Your Account Statement as on 18/04/2026,,,,,,,,,,,,,,,\n" +
            "OMPRAKASH GAUTAM,,,,,,,,,,,Savings Account - 368XXXXXXXX803,,,,\n" +
            "TRAN DATE,,VALUE DATE,,NARRATION,,,CHQ.NO.,WITHDRAWAL(DR),,,,DEPOSIT(CR),,BALANCE(INR),\n" +
            "05/11/2012,,01/11/2012,,Int.:17-07-2012 To 31-10-2012,,,,,,,,12.00,, 1012.00Cr,\n" +
            "17/07/2012,,17/07/2012,,BY CASH,,,,,,,,1000.00,, 1000.00Cr,\n" +
            "18/04/2026 23:24,,,,,,Contact-Us@18005700,,,,,,,,Page 1 of, 1\n";

    @Test
    void parse_extractsAccountHolderName() throws Exception {
        MockMultipartFile file = csv("statement.csv", SAMPLE_CSV);
        ParsedStatement result = parser.parse(file);
        assertThat(result.accountHolderName()).isEqualTo("OMPRAKASH GAUTAM");
    }

    @Test
    void parse_extractsAccountNumber() throws Exception {
        MockMultipartFile file = csv("statement.csv", SAMPLE_CSV);
        ParsedStatement result = parser.parse(file);
        assertThat(result.accountNumberMasked()).isEqualTo("368XXXXXXXX803");
    }

    @Test
    void parse_setsBankNameAndAccountType() throws Exception {
        MockMultipartFile file = csv("statement.csv", SAMPLE_CSV);
        ParsedStatement result = parser.parse(file);
        assertThat(result.bankName()).isEqualTo("Bank of Baroda");
        assertThat(result.accountType()).isEqualTo("Savings");
    }

    @Test
    void parse_parsesTwoTransactions() throws Exception {
        MockMultipartFile file = csv("statement.csv", SAMPLE_CSV);
        ParsedStatement result = parser.parse(file);
        assertThat(result.transactions()).hasSize(2);
    }

    @Test
    void parse_firstTransactionIsInterestCredit() throws Exception {
        MockMultipartFile file = csv("statement.csv", SAMPLE_CSV);
        ParsedStatement.ParsedTransaction tx = parser.parse(file).transactions().get(0);
        assertThat(tx.transactionDate()).isEqualTo(LocalDate.of(2012, 11, 5));
        assertThat(tx.valueDate()).isEqualTo(LocalDate.of(2012, 11, 1));
        assertThat(tx.rawRemarks()).isEqualTo("Int.:17-07-2012 To 31-10-2012");
        assertThat(tx.withdrawalAmount()).isEqualByComparingTo(BigDecimal.ZERO);
        assertThat(tx.depositAmount()).isEqualByComparingTo(new BigDecimal("12.00"));
        assertThat(tx.balance()).isEqualByComparingTo(new BigDecimal("1012.00"));
        assertThat(tx.chequeNumber()).isNull();
    }

    @Test
    void parse_secondTransactionIsCashDeposit() throws Exception {
        MockMultipartFile file = csv("statement.csv", SAMPLE_CSV);
        ParsedStatement.ParsedTransaction tx = parser.parse(file).transactions().get(1);
        assertThat(tx.transactionDate()).isEqualTo(LocalDate.of(2012, 7, 17));
        assertThat(tx.valueDate()).isEqualTo(LocalDate.of(2012, 7, 17));
        assertThat(tx.rawRemarks()).isEqualTo("BY CASH");
        assertThat(tx.withdrawalAmount()).isEqualByComparingTo(BigDecimal.ZERO);
        assertThat(tx.depositAmount()).isEqualByComparingTo(new BigDecimal("1000.00"));
        assertThat(tx.balance()).isEqualByComparingTo(new BigDecimal("1000.00"));
    }

    @Test
    void parse_throwsWhenNoHeaderRowFound() {
        String badCsv = "some,random,data\nno,header,here\n";
        MockMultipartFile file = csv("bad.csv", badCsv);
        assertThatThrownBy(() -> parser.parse(file))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("Could not find transaction header row");
    }

    private MockMultipartFile csv(String filename, String content) {
        return new MockMultipartFile("files", filename, "text/csv",
                content.getBytes(StandardCharsets.UTF_8));
    }
}
