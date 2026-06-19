import axios from "axios";
import { getStoredToken } from "@/lib/auth-storage";
import { isAuthBypassEnabled as resolveAuthBypassEnabled } from "@/lib/auth-config";

const isAuthBypassEnabled = resolveAuthBypassEnabled();
const DEMO_TOKEN = "demo-token";

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000/api",
  headers: {
    Accept: "application/json",
  },
});

api.interceptors.request.use((config) => {
  const token = getStoredToken();
  const activeToken = token || (isAuthBypassEnabled ? DEMO_TOKEN : "");

  if (activeToken && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${activeToken}`;
  }

  return config;
});
