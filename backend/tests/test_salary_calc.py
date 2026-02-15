"""
Tests for Salary Calculation Service:
- calculate_taxes (Gross → Net)
- solve_gross_from_net (Net → Gross reverse)
- Round-trip accuracy
- Edge cases (zero, very large, no deduction)
"""
import sys, os
sys.path.append(os.path.dirname(os.path.abspath(__file__)) + "/..")

from services.salary_service import calculate_taxes, solve_gross_from_net
from database.models import SalaryConfiguration


def make_config(**overrides):
    """Create a mock SalaryConfiguration object."""
    defaults = dict(
        mrp=4325, mzp=85000,
        opv_rate=0.1, opvr_rate=0.025,
        vosms_rate=0.02, vosms_employer_rate=0.03,
        so_rate=0.035, sn_rate=0.095, ipn_rate=0.1,
        opv_limit_mzp=50, opvr_limit_mzp=50, vosms_limit_mzp=10,
        ipn_deduction_mrp=14,
    )
    defaults.update(overrides)
    config = SalaryConfiguration(**defaults)
    return config


class TestCalculateTaxes:
    """Test the forward calculation: Gross → Net with all tax components."""

    def test_basic_100k(self):
        config = make_config()
        res = calculate_taxes(100_000, config)

        assert res["gross"] == 100_000
        assert res["net"] > 0
        assert res["net"] < 100_000
        assert res["opv"] == 10_000  # 10% of 100k (within 50*85k cap)
        assert res["vosms"] == 2_000  # 2% of 100k (within 10*85k cap)
        # IPN = (100000 - 10000 - 2000 - 14*4325) * 10%
        expected_deduction = 14 * 4325
        ipn_base = 100_000 - 10_000 - 2_000 - expected_deduction
        expected_ipn = max(0, ipn_base) * 0.1
        assert abs(res["ipn"] - expected_ipn) < 1

    def test_zero_gross(self):
        config = make_config()
        res = calculate_taxes(0, config)
        assert res["gross"] == 0
        assert res["net"] == 0
        assert res["opv"] == 0
        assert res["ipn"] == 0

    def test_very_large_gross_hits_caps(self):
        config = make_config()
        gross = 10_000_000  # 10 million
        res = calculate_taxes(gross, config)

        # OPV capped at 50 * 85000 = 4_250_000
        assert res["opv"] == 4_250_000 * 0.1

        # VOSMS capped at 10 * 85000 = 850_000
        assert res["vosms"] == 850_000 * 0.02

    def test_no_deduction(self):
        config = make_config()
        res_with = calculate_taxes(200_000, config, apply_deduction=True)
        res_without = calculate_taxes(200_000, config, apply_deduction=False)

        # Without deduction, IPN should be higher → Net lower
        assert res_without["net"] < res_with["net"]
        assert res_without["ipn"] > res_with["ipn"]

    def test_employer_taxes_present(self):
        config = make_config()
        res = calculate_taxes(300_000, config)
        assert res["osms"] > 0
        assert res["so"] > 0
        assert res["sn"] >= 0
        assert res["opvr"] > 0

    def test_net_plus_taxes_equals_gross(self):
        """Net + OPV + VOSMS + IPN should equal Gross."""
        config = make_config()
        res = calculate_taxes(500_000, config)
        reconstructed = res["net"] + res["opv"] + res["vosms"] + res["ipn"]
        assert abs(reconstructed - res["gross"]) < 1


class TestSolveGrossFromNet:
    """Test the reverse calculation: Net → Gross."""

    def test_round_trip_100k(self):
        config = make_config()
        original_gross = 100_000
        fwd = calculate_taxes(original_gross, config)
        target_net = fwd["net"]

        solved_gross = solve_gross_from_net(target_net, config)
        assert abs(solved_gross - original_gross) < 1

    def test_round_trip_various(self):
        config = make_config()
        for gross in [85_000, 150_000, 300_000, 500_000, 1_000_000, 5_000_000]:
            fwd = calculate_taxes(gross, config)
            solved = solve_gross_from_net(fwd["net"], config)
            assert abs(solved - gross) < 1, f"Round-trip failed for gross={gross}: solved={solved}"

    def test_round_trip_no_deduction(self):
        config = make_config()
        gross = 200_000
        fwd = calculate_taxes(gross, config, apply_deduction=False)
        solved = solve_gross_from_net(fwd["net"], config, apply_deduction=False)
        assert abs(solved - gross) < 1

    def test_small_net(self):
        config = make_config()
        solved = solve_gross_from_net(50_000, config)
        assert solved > 50_000  # Gross > Net always
        # Verify by forward calc
        fwd = calculate_taxes(solved, config)
        assert abs(fwd["net"] - 50_000) < 1
