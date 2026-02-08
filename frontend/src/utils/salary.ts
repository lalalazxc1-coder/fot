export type SalaryConfig = {
    mrp: number;
    mzp: number;
    opv_rate: number;
    opvr_rate: number; // NEW
    vosms_rate: number;
    vosms_employer_rate: number;
    so_rate: number;
    sn_rate: number;
    ipn_rate: number;
    opv_limit_mzp: number;
    opvr_limit_mzp: number; // NEW
    vosms_limit_mzp: number;
    ipn_deduction_mrp: number;
};

export const DEFAULT_CONFIG: SalaryConfig = {
    mrp: 4325,
    mzp: 85000,
    opv_rate: 0.1,
    opvr_rate: 0.025, // 2026
    vosms_rate: 0.02,
    vosms_employer_rate: 0.03,
    so_rate: 0.035,
    sn_rate: 0.095,
    ipn_rate: 0.1,
    opv_limit_mzp: 50,
    opvr_limit_mzp: 50,
    vosms_limit_mzp: 10,
    ipn_deduction_mrp: 14
};

export function calculateTaxes(gross: number, config: SalaryConfig, applyDeduction: boolean = true) {
    if (!gross || gross < 0) return { gross: 0, net: 0, opv: 0, vosms: 0, ipn: 0 };

    // 1. OPV
    const opvBase = Math.min(gross, config.opv_limit_mzp * config.mzp);
    const opv = opvBase * config.opv_rate;

    // 2. VOSMS
    const vosmsBase = Math.min(gross, config.vosms_limit_mzp * config.mzp);
    const vosms = vosmsBase * config.vosms_rate;

    // 3. IPN
    const deduction = applyDeduction ? (config.ipn_deduction_mrp * config.mrp) : 0;
    let ipnBase = gross - opv - vosms - deduction;
    if (ipnBase < 0) ipnBase = 0;

    // Correction for low income (skipped for consistency with backend simplified model)
    const ipn = ipnBase * config.ipn_rate;

    // 4. Net
    const net = gross - opv - vosms - ipn;

    // 5. Employer Side (Calc only)
    const opvrBase = Math.min(gross, (config.opvr_limit_mzp || 50) * config.mzp);
    const opvr = opvrBase * (config.opvr_rate || 0);

    return {
        gross: Math.round(gross),
        net: Math.round(net),
        opv: Math.round(opv),
        vosms: Math.round(vosms),
        ipn: Math.round(ipn),
        opvr: Math.round(opvr)
    };
}

export function solveGrossFromNet(net: number, config: SalaryConfig, applyDeduction: boolean = true): number {
    if (!net || net < 0) return 0;

    // Binary search
    let low = net;
    let high = net * 2.5; // Wider range
    let mid = 0;

    for (let i = 0; i < 20; i++) {
        mid = (low + high) / 2;
        const res = calculateTaxes(mid, config, applyDeduction);

        if (Math.abs(res.net - net) < 1) {
            return Math.round(mid);
        }

        if (res.net < net) {
            low = mid;
        } else {
            high = mid;
        }
    }

    return Math.round(mid);
}
