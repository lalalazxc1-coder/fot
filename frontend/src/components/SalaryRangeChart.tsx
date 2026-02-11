import { formatMoney } from '../utils';

type Props = {
    min: number;
    max: number;
    median: number;
    employeeSalaries: number[];
};

export default function SalaryRangeChart({ min, max, median, employeeSalaries }: Props) {
    if (!min || !max) return null;

    // Determine the range to display
    // We want to show the full market range [min, max]
    // And also any outliers from employees
    const values = [min, max, median, ...employeeSalaries].filter(v => v > 0);
    if (values.length === 0) return null;

    const minValue = Math.min(...values) * 0.9; // Add 10% padding
    const maxValue = Math.max(...values) * 1.1; // Add 10% padding

    const range = maxValue - minValue;
    if (range <= 0) return null;

    const getPercent = (val: number) => Math.max(0, Math.min(100, ((val - minValue) / range) * 100));

    return (
        <div className="relative h-8 w-full min-w-[200px] flex items-center select-none group" title="Шкала зарплат">
            {/* Base Line (Track) */}
            <div className="absolute left-0 right-0 h-1 bg-slate-100 rounded-full" />

            {/* Market Range Bar (Min to Max) */}
            <div
                className="absolute h-1.5 bg-slate-300/50 rounded-full"
                style={{
                    left: `${getPercent(min)}%`,
                    width: `${Math.max(2, getPercent(max) - getPercent(min))}%`
                }}
                title={`Рыночный диапазон: ${formatMoney(min)} - ${formatMoney(max)}`}
            />

            {/* Median Marker */}
            <div
                className="absolute top-1/2 -translate-y-1/2 flex flex-col items-center group/median z-10"
                style={{ left: `${getPercent(median)}%` }}
            >
                <div className="w-1 h-4 bg-emerald-500 rounded-full" />
                <div className="absolute opacity-0 group-hover/median:opacity-100 bottom-full mb-1 text-[10px] bg-slate-800 text-white px-1 py-0.5 rounded pointer-events-none whitespace-nowrap transition-opacity">
                    Медиана: {formatMoney(median)}
                </div>
            </div>

            {/* Employee Dots */}
            {employeeSalaries.map((salary, i) => {
                const isBelow = salary < median;
                const isAbove = salary > median;
                const colorClass = isBelow ? 'bg-red-500' : isAbove ? 'bg-blue-500' : 'bg-emerald-500';

                return (
                    <div
                        key={i}
                        className={`absolute w-2 h-2 rounded-full top-1/2 -translate-y-1/2 z-20 shadow-sm border border-white cursor-help ${colorClass} hover:z-30 hover:scale-150 transition-all`}
                        style={{ left: `${getPercent(salary)}%` }}
                        title={`Сотрудник: ${formatMoney(salary)}`}
                    />
                );
            })}
        </div>
    );
}
