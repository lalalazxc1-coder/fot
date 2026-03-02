import { render, screen } from '@testing-library/react';
import AnalyticsPage from './AnalyticsPage';

jest.mock('../hooks/useAnalytics', () => ({
  useAnalytics: () => ({
    summary: {
      data: {
        fact: { total_net: 0, count: 0 },
        plan: { total_net: 0, count: 0 },
        metrics: {
          diff_net: 0,
          execution_percent: 0,
          headcount_diff: 0,
          is_over_budget: false,
        },
        cached_at: new Date().toISOString(),
      },
      isLoading: false,
    },
    branchComparison: { data: [] },
    topEmployees: { data: [] },
    costDistribution: { data: [] },
    isLoading: false,
  }),
  useRefreshAnalytics: () => ({ mutate: jest.fn(), isPending: false }),
}));

jest.mock('../components/analytics/RetentionDashboard', () => ({
  RetentionDashboard: () => <div data-testid="retention-dashboard" />, 
}));

jest.mock('../components/analytics/ESGReport', () => ({
  ESGReport: () => <div data-testid="esg-report" />,
}));

jest.mock('../components/analytics/StaffingGapsView', () => ({
  StaffingGapsView: () => <div data-testid="staffing-gaps" />,
}));

jest.mock('../components/TimeTravelPicker', () => ({
  TimeTravelPicker: () => <div data-testid="time-travel-picker" />,
}));

jest.mock('../components/analytics/AnalyticsEmployeeListModal', () => ({
  AnalyticsEmployeeListModal: () => null,
}));

describe('AnalyticsPage', () => {
  it('renders without crash', () => {
    render(<AnalyticsPage />);
    expect(screen.getByText(/аналитика/i)).toBeInTheDocument();
  });
});
