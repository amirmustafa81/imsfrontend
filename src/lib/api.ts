import axios from "axios";
import { getStoredToken } from "@/lib/auth-storage";

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000/api",
  headers: {
    Accept: "application/json",
  },
});

api.interceptors.request.use((config) => {
  const token = getStoredToken();

  if (token && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});
