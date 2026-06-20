"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isAuthBypassEnabled, useAuth } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const { isAuthenticated, loading, login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isAuthBypassEnabled) {
      if (!loading) {
        router.replace("/");
      }

      return;
    }

    if (!loading && isAuthenticated) {
      router.replace("/");
    }
  }, [isAuthenticated, loading, router]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      await login({ email, password });
      router.replace("/");
    } catch {
      setError("Invalid email or password.");
    } finally {
      setSubmitting(false);
    }
  };

  if (isAuthBypassEnabled) {
    if (loading) {
      return (
        <main className="min-vh-100 d-flex align-items-center justify-content-center bg-body-tertiary">
          <div className="text-center">
            <div className="spinner-border text-primary mb-3" role="status" />
            <div className="fw-semibold">Preparing IMS workspace…</div>
          </div>
        </main>
      );
    }

    return (
      <main className="min-vh-100 d-flex align-items-center justify-content-center bg-body-tertiary">
        <div className="text-center">
          <div className="text-primary fw-semibold">Login is currently disabled. Redirecting to dashboard…</div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-vh-100 ims-login-page">
      <div className="container-fluid min-vh-100 px-0">
        <div className="row g-0 min-vh-100">
          <section className="col-12 col-lg-5 col-xl-4 d-none d-lg-flex align-items-center ims-login-brand-panel">
            <div className="ims-login-brand-content">
              <div className="d-inline-flex align-items-center justify-content-center ims-login-emblem mb-4">
                <i className="bi bi-buildings" />
              </div>
              <h1 className="fw-bold mb-3">UOH Inventory Management System</h1>
              <p className="mb-0">
                Secure access for inventory, fixed assets, verification, reporting, and compliance workflows.
              </p>
            </div>
          </section>

          <section className="col-12 col-lg-7 col-xl-8 d-flex align-items-center justify-content-center p-4 p-lg-5">
            <div className="card border-0 shadow-sm ims-login-card w-100">
              <div className="card-body">
                <div className="mb-4">
                  <div className="d-flex align-items-center gap-2 mb-3">
                    <span className="d-inline-flex align-items-center justify-content-center ims-login-mobile-emblem">
                      <i className="bi bi-buildings" />
                    </span>
                    <span className="fw-bold">UOH IMS</span>
                  </div>
                  <h2 className="h3 fw-bold mb-1">Sign in</h2>
                  <div className="text-secondary">Use your authorized IMS account to continue.</div>
                </div>

                {error ? <div className="alert alert-danger py-2">{error}</div> : null}

                <form onSubmit={submit}>
                  <div className="mb-3">
                    <label className="form-label small fw-semibold" htmlFor="email">
                      Email address
                    </label>
                    <input
                      id="email"
                      className="form-control"
                      type="email"
                      autoComplete="email"
                      placeholder="admin@uoh.edu.pk"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      required
                    />
                  </div>

                  <div className="mb-4">
                    <label className="form-label small fw-semibold" htmlFor="password">
                      Password
                    </label>
                    <input
                      id="password"
                      className="form-control"
                      type="password"
                      autoComplete="current-password"
                      placeholder="Enter password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      required
                    />
                  </div>

                  <button className="btn btn-primary w-100" type="submit" disabled={submitting || loading}>
                    {submitting ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2" aria-hidden="true" />
                        Signing in
                      </>
                    ) : (
                      <>
                        <i className="bi bi-box-arrow-in-right me-2" />
                        Sign in
                      </>
                    )}
                  </button>
                </form>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
