import { redirect } from "next/navigation";

import { isAuthenticated } from "@/lib/auth";

type LoginPageProps = {
  searchParams: Promise<{ next?: string; error?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  if (await isAuthenticated()) {
    redirect("/");
  }

  const params = await searchParams;
  const next = params.next ?? "/";
  const error = params.error === "invalid_credentials";

  return (
    <main className="login-wrap">
      <section className="login-card">
        <p className="pill">Internal Team Access</p>
        <h1>Marketing System Health Dashboard</h1>
        <p>
          Sign in with your team email and shared internal password. This starter auth keeps the
          project private while you validate the dashboard with the team.
        </p>
        <form action="/login/submit" method="post">
          <input type="hidden" name="next" value={next} />
          <label>
            Email
            <input name="email" type="email" autoComplete="email" placeholder="you@example.com" required />
          </label>
          <label>
            Password
            <input name="password" type="password" autoComplete="current-password" required />
          </label>
          {error ? <p className="error">Invalid credentials or email not on the allow-list.</p> : null}
          <button className="button" type="submit">
            Sign In
          </button>
        </form>
      </section>
    </main>
  );
}
