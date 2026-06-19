const parseAuthFlag = (value: string | undefined, defaultValue: boolean) => {
  if (value === undefined || value === "") {
    return defaultValue;
  }

  const normalized = value.trim().toLowerCase();

  if (["false", "0", "off", "no"].includes(normalized)) {
    return false;
  }

  if (["true", "1", "on", "yes"].includes(normalized)) {
    return true;
  }

  return defaultValue;
};

export const isAuthBypassEnabled = () => {
  if (parseAuthFlag(process.env.NEXT_PUBLIC_GUEST_MODE, false)) {
    return true;
  }

  if (parseAuthFlag(process.env.NEXT_PUBLIC_ALLOW_ANONYMOUS_ACCESS, false)) {
    return true;
  }

  if (parseAuthFlag(process.env.NEXT_PUBLIC_TEMP_DISABLE_AUTH, false)) {
    return true;
  }

  if (parseAuthFlag(process.env.NEXT_PUBLIC_FORCE_DISABLE_AUTH, false)) {
    return true;
  }

  return parseAuthFlag(process.env.NEXT_PUBLIC_DISABLE_AUTH, false);
};
