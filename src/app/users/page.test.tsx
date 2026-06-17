import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import UsersPage from "./page";

const mockedApi = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  api: {
    get: mockedApi.get,
    post: mockedApi.post,
    put: mockedApi.put,
  },
}));

vi.mock("next/link", () => ({
  default: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}));

const fakeStorage = (() => {
  const data = new Map<string, string>();

  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, String(value));
    },
    removeItem: (key: string) => {
      data.delete(key);
    },
    clear: () => {
      data.clear();
    },
  };
})();

const roles = [{ id: 1, name: "Store Admin" }];
const departments = [{ id: 2, name: "Computer Science", code: "CSE" }];
const users = [
  {
    id: 7,
    name: "Areeba Khan",
    email: "areeba@example.com",
    employee_code: "EMP-7",
    phone: "03001234567",
    designation: "Manager",
    access_scope: "department",
    status: "active",
    department_id: 2,
    roles: roles,
  },
];

beforeEach(() => {
  Object.defineProperty(globalThis, "localStorage", {
    value: fakeStorage,
    configurable: true,
    writable: true,
  });

  if (typeof window !== "undefined") {
    Object.defineProperty(window, "localStorage", {
      value: fakeStorage,
      configurable: true,
      writable: true,
    });
  }

  fakeStorage.clear();
  localStorage.setItem("ims_api_token", "test-token");

  mockedApi.get.mockImplementation((url: string) => {
    if (url === "/roles") return Promise.resolve({ data: { data: roles } });
    if (url === "/master-data/departments") return Promise.resolve({ data: { data: departments } });
    if (url === "/users") return Promise.resolve({ data: { data: users } });
    return Promise.resolve({ data: { data: [] } });
  });
  mockedApi.post.mockResolvedValue({ data: { data: { id: 8 } } });
  mockedApi.put.mockResolvedValue({ data: { data: { id: 7 } } });
});

afterEach(() => {
  mockedApi.get.mockReset();
  mockedApi.post.mockReset();
  mockedApi.put.mockReset();
  fakeStorage.clear();
});

describe("UsersPage", () => {
  test("creates a user with role assignment", async () => {
    const user = userEvent.setup();
    render(<UsersPage />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Create user/i })).toBeInTheDocument();
      expect(screen.getByText("Areeba Khan")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /Create user/i }));
    await user.type(screen.getByLabelText(/Name/i), "Bilal Ahmed");
    await user.type(screen.getByLabelText(/^Email$/i), "bilal@example.com");
    await user.type(screen.getByLabelText(/^Password$/i), "Secret123");
    await user.selectOptions(screen.getByLabelText(/Department/i), "2");
    await user.selectOptions(screen.getByLabelText(/Roles/i), "1");
    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: /^Create User$/i }));

    await waitFor(() => {
      expect(mockedApi.post).toHaveBeenCalledWith(
        "/users",
        expect.objectContaining({
          name: "Bilal Ahmed",
          email: "bilal@example.com",
          department_id: 2,
          role_ids: [1],
        }),
        expect.anything(),
      );
    });
  });

  test("loads an existing user into edit flow and saves updates", async () => {
    const user = userEvent.setup();
    render(<UsersPage />);

    await waitFor(() => {
      expect(screen.getByText("Areeba Khan")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /Edit user/i }));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Save Changes/i })).toBeInTheDocument();
    });

    const nameInput = screen.getByLabelText(/Name/i);
    await user.clear(nameInput);
    await user.type(nameInput, "Areeba Noor");
    await user.click(screen.getByRole("button", { name: /Save Changes/i }));

    await waitFor(() => {
      expect(mockedApi.put).toHaveBeenCalledWith(
        "/users/7",
        expect.objectContaining({
          name: "Areeba Noor",
          email: "areeba@example.com",
          role_ids: [1],
        }),
        expect.anything(),
      );
    });
  });
});
