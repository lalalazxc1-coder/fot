import { render, screen } from '@testing-library/react';
import RequestsPage from './RequestsPage';

jest.mock('../hooks/useRequests', () => ({
  useRequests: () => ({ data: { items: [], total_pages: 1 }, isLoading: false }),
  useUpdateRequestStatus: () => ({ mutate: jest.fn(), mutateAsync: jest.fn() }),
}));

jest.mock('../hooks/useEmployees', () => ({
  useEmployees: () => ({ data: [], isLoading: false }),
}));

jest.mock('./requests/CreateRequestModal', () => ({
  CreateRequestModal: () => null,
}));

jest.mock('./requests/RequestDetailsModal', () => ({
  RequestDetailsModal: () => null,
}));

describe('RequestsPage', () => {
  it('renders without crash', () => {
    render(<RequestsPage />);
    expect(screen.getByText(/заявки на пересмотр/i)).toBeInTheDocument();
  });
});
