"use client";

export const IMS_TOKEN_KEY = "ims_api_token";

export const getStoredToken = () => {
  if (typeof window === "undefined") {
    return "";
  }

  return localStorage.getItem(IMS_TOKEN_KEY) ?? "";
};

export const setStoredToken = (token: string) => {
  if (typeof window === "undefined") {
    return;
  }

  localStorage.setItem(IMS_TOKEN_KEY, token);
};

export const clearStoredToken = () => {
  if (typeof window === "undefined") {
    return;
  }

  localStorage.removeItem(IMS_TOKEN_KEY);
};
