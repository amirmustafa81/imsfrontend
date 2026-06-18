import axios from "axios";
import { getStoredToken } from "@/lib/auth-storage";

const isAuthBypassEnabled =
  process.env.NEXT_PUBLIC_DISABLE_AUTH === "true" || process.env.NEXT_PUBLIC_DISABLE_AUTH === "1";

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000/api",
  headers: {
    Accept: "application/json",
  },
});

api.interceptors.request.use((config) => {
  const token = getStoredToken();

  if (!isAuthBypassEnabled && token && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});
