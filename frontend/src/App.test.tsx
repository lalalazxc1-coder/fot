import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from './App';
import React from 'react';

const mockGet = jest.fn();

jest.mock('./lib/api', () => ({
  api: {
    get: (...args: unknown[]) => mockGet(...args),
    post: jest.fn(),
  },
}));

jest.mock('./context/SnapshotContext', () => ({
  SnapshotProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe('App routing guards', () => {
  beforeEach(() => {
    mockGet.mockReset();
    localStorage.clear();
    sessionStorage.clear();
  });

  it('redirects guest to login on protected route', async () => {
    mockGet.mockRejectedValue({ response: { status: 401 } });

    render(
      <MemoryRouter initialEntries={['/analytics']}>
        <App />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/логин или email/i)).toBeInTheDocument();
    });
  });
});
