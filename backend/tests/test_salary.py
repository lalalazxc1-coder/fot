
import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)) + "/..")

from routers.salary import calculate_taxes, solve_gross_from_net, SalaryConfiguration
from pydantic import ValidationError
from routers.salary import SalaryBreakdown

# Mock Config
config = SalaryConfiguration(
    mrp=4325,
    mzp=85000,
    opv_rate=0.1,
    opvr_rate=0.025,
    vosms_rate=0.02,
    vosms_employer_rate=0.03,
    so_rate=0.035,
    sn_rate=0.095,
    ipn_rate=0.1,
    opv_limit_mzp=50,
    opvr_limit_mzp=50,
    vosms_limit_mzp=10,
    ipn_deduction_mrp=14
)

def test_salary_calculation():
    print("Testing Salary Calculation...")
    
    # Test 1: Simple Gross -> Net
    gross = 100000
    res = calculate_taxes(gross, config)
    print(f"Gross: {gross} -> Net: {res['net']}")
    
    # Test 2: Net -> Gross (Reverse)
    target_net = res['net']
    calc_gross = solve_gross_from_net(target_net, config)
    print(f"Target Net: {target_net} -> Calc Gross: {calc_gross}")
    
    assert abs(gross - calc_gross) < 1.0, f"Round trip failed: {gross} vs {calc_gross}"
    
    # Test 3: Response Model Validation (This was the bug)
    print("Testing Response Model...")
    
    # Construct response dict manually matching what the endpoint does
    response_dict = {
        "gross": res['gross'],
        "net": res['net'],
        "opv": res['opv'],
        "vosms": res['vosms'],
        "ipn": res['ipn'],
        "osms": res['osms'],
        "so": res['so'],
        "sn": res['sn'],
        "opvr": res['opvr'], # Added field
        "deduction_applied": res['deduction']
    }
    
    try:
        model = SalaryBreakdown(**response_dict)
        print("Validation Passed!")
    except ValidationError as e:
        print(f"Validation Failed: {e}")
        exit(1)

if __name__ == "__main__":
    test_salary_calculation()
