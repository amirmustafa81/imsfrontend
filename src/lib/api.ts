import axios from "axios";
import { getStoredToken } from "@/lib/auth-storage";

const resolveAuthBypass = () => {
  const value = process.env.NEXT_PUBLIC_DISABLE_AUTH;

  if (value === undefined || value === "") {
    return true;
  }

  const normalized = value.trim().toLowerCase();
  if (["false", "0", "off", "no"].includes(normalized)) {
    return false;
  }

  return ["true", "1", "on", "yes"].includes(normalized);
};

const isAuthBypassEnabled = resolveAuthBypass();

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
