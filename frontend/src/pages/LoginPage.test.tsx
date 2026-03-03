import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import LoginPage from './LoginPage';

const mockPost = jest.fn();

jest.mock('../lib/api', () => ({
  api: {
    post: (...args: unknown[]) => mockPost(...args),
  },
}));

describe('LoginPage', () => {
  beforeEach(() => {
    mockPost.mockReset();
    localStorage.clear();
  });

  it('renders login form', () => {
    render(<LoginPage onLogin={jest.fn()} />);

    expect(screen.getByText(/логин или email/i)).toBeInTheDocument();
    expect(screen.getByText(/пароль/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /войти в систему/i })).toBeInTheDocument();
  });

  it('submits login successfully and calls onLogin', async () => {
    const onLogin = jest.fn();

    mockPost.mockResolvedValue({
      data: {
        user_id: 1,
        full_name: 'Admin User',
        email: 'admin@test.com',
        contact_email: 'admin@company.com',
        phone: '+77000000000',
        role: 'Administrator',
        permissions: { admin_access: true },
        scope_branches: [],
        scope_departments: [],
        avatar_url: null,
        job_title: null,
      },
    });

    render(<LoginPage onLogin={onLogin} />);

    fireEvent.change(screen.getByPlaceholderText(/введите ваш логин/i), {
      target: { value: 'admin@test.com' },
    });

    fireEvent.change(screen.getByPlaceholderText(/••••••••/i), {
      target: { value: 'admin123' },
    });

    fireEvent.click(screen.getByRole('button', { name: /войти в систему/i }));

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith('/auth/login', {
        username: 'admin@test.com',
        password: 'admin123',
        remember_me: false,
      });
    });

    await waitFor(
      () => {
        expect(onLogin).toHaveBeenCalled();
      },
      { timeout: 2500 }
    );
  });
});
