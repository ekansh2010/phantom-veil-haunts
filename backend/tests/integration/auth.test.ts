import { describe, expect, it } from "vitest";
import jwt from "jsonwebtoken";
import { User } from "../../src/models";
import { api, auth, lastResetToken, registerUser } from "../helpers";

describe("POST /api/auth/register", () => {
  it("creates a user and returns a token, user and session", async () => {
    const res = await api().post("/api/auth/register").send({ email: "Raven@Veil.test", password: "Spooky123", username: "Raven" });
    expect(res.status).toBe(201);
    expect(res.body.token).toBeTypeOf("string");
    expect(res.body.session.access_token).toBe(res.body.token);
    expect(res.body.user).toMatchObject({ email: "raven@veil.test", username: "Raven", role: "user", favorite_genre: "" });
    expect(res.body.user.passwordHash).toBeUndefined();

    const stored = await User.findOne({ email: "raven@veil.test" }).lean();
    expect(stored?.passwordHash).toMatch(/^\$2[aby]\$/); // bcrypt, never plaintext
  });

  it("derives a unique username from the email when omitted", async () => {
    await registerUser({ username: "crow", email: "other@veil.test" });
    const res = await api().post("/api/auth/register").send({ email: "crow@veil.test", password: "Spooky123" });
    expect(res.status).toBe(201);
    expect(res.body.user.username).toBe("crow2");
  });

  it("ignores a client-supplied role (no privilege escalation)", async () => {
    const res = await api().post("/api/auth/register").send({ email: "sneaky@veil.test", password: "Spooky123", role: "admin" });
    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe("user");
  });

  it("rejects duplicate emails (case-insensitive) with 409", async () => {
    await registerUser({ email: "dup@veil.test" });
    const res = await api().post("/api/auth/register").send({ email: "DUP@veil.test", password: "Spooky123" });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe("Email is already registered");
  });

  it("rejects duplicate usernames (case-insensitive) with 409", async () => {
    await registerUser({ username: "Wraith" });
    const res = await api().post("/api/auth/register").send({ email: "w2@veil.test", password: "Spooky123", username: "wraith" });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe("Username is already taken");
  });

  it.each([
    [{ password: "Spooky123" }, "Email is required"],
    [{ email: "not-an-email", password: "Spooky123" }, "Email must be valid"],
    [{ email: "a@veil.test", password: "short1" }, "Password must be at least 8 characters long"],
    [{ email: "a@veil.test", password: "nodigitshere" }, "Password must contain at least one number"],
    [{ email: "a@veil.test", password: "Spooky123", username: "bad name!" }, "Username may only contain letters, numbers, '_', '.' and '-'"],
  ])("validates input %#", async (body, message) => {
    const res = await api().post("/api/auth/register").send(body);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe(message);
    expect(Array.isArray(res.body.details)).toBe(true);
  });
});

describe("POST /api/auth/login", () => {
  it("logs in with valid credentials (email is case-insensitive)", async () => {
    const u = await registerUser({ email: "lantern@veil.test" });
    const res = await api().post("/api/auth/login").send({ email: "LANTERN@veil.test", password: u.password });
    expect(res.status).toBe(200);
    expect(res.body.user.id).toBe(u.user.id);
    expect(res.body.session.access_token).toBe(res.body.token);
  });

  it("returns the same 401 for a wrong password and an unknown email", async () => {
    await registerUser({ email: "known@veil.test" });
    const wrong = await api().post("/api/auth/login").send({ email: "known@veil.test", password: "Wrong1234" });
    const unknown = await api().post("/api/auth/login").send({ email: "nobody@veil.test", password: "Wrong1234" });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body).toEqual(unknown.body);
  });

  it("requires a password", async () => {
    const res = await api().post("/api/auth/login").send({ email: "a@veil.test" });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Password is required");
  });
});

describe("GET /api/auth/me", () => {
  it("returns the current user", async () => {
    const u = await registerUser();
    const res = await api().get("/api/auth/me").set(auth(u.token));
    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ id: u.user.id, email: u.user.email });
  });

  it("401 without a token", async () => {
    const res = await api().get("/api/auth/me");
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Access token is missing");
  });

  it("401 for malformed, wrongly signed or non-bearer tokens", async () => {
    const u = await registerUser();
    const forged = jwt.sign({ tv: 0 }, "some-other-secret", { subject: u.user.id });
    for (const header of ["Bearer garbage", `Bearer ${forged}`, `Basic ${u.token}`]) {
      const res = await api().get("/api/auth/me").set("Authorization", header);
      expect(res.status).toBe(401);
    }
  });

  it("401 for an expired token", async () => {
    const u = await registerUser();
    const expired = jwt.sign({ tv: 0, exp: Math.floor(Date.now() / 1000) - 10 }, process.env.JWT_SECRET!, { subject: u.user.id });
    const res = await api().get("/api/auth/me").set(auth(expired));
    expect(res.status).toBe(401);
  });

  it("rejects a token whose algorithm is 'none'", async () => {
    const u = await registerUser();
    const none = jwt.sign({ tv: 0 }, "", { algorithm: "none", subject: u.user.id });
    const res = await api().get("/api/auth/me").set(auth(none));
    expect(res.status).toBe(401);
  });

  it("401 once the user is deleted", async () => {
    const u = await registerUser();
    await User.deleteOne({ id: u.user.id });
    const res = await api().get("/api/auth/me").set(auth(u.token));
    expect(res.status).toBe(401);
  });
});

describe("POST /api/auth/logout", () => {
  it("revokes existing tokens", async () => {
    const u = await registerUser();
    const out = await api().post("/api/auth/logout").set(auth(u.token));
    expect(out.status).toBe(200);
    const res = await api().get("/api/auth/me").set(auth(u.token));
    expect(res.status).toBe(401);
  });

  it("requires authentication", async () => {
    expect((await api().post("/api/auth/logout")).status).toBe(401);
  });
});

describe("POST /api/auth/change-password", () => {
  it("changes the password, returns a fresh token and revokes the old one", async () => {
    const u = await registerUser();
    const res = await api().post("/api/auth/change-password").set(auth(u.token)).send({ currentPassword: u.password, newPassword: "NewSpooky456" });
    expect(res.status).toBe(200);
    expect((await api().get("/api/auth/me").set(auth(u.token))).status).toBe(401);
    expect((await api().get("/api/auth/me").set(auth(res.body.token))).status).toBe(200);
    const login = await api().post("/api/auth/login").send({ email: u.user.email, password: "NewSpooky456" });
    expect(login.status).toBe(200);
  });

  it("400 when the current password is wrong", async () => {
    const u = await registerUser();
    const res = await api().post("/api/auth/change-password").set(auth(u.token)).send({ currentPassword: "Nope12345", newPassword: "NewSpooky456" });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Current password is incorrect");
  });

  it("validates the new password", async () => {
    const u = await registerUser();
    const res = await api().post("/api/auth/change-password").set(auth(u.token)).send({ currentPassword: u.password, newPassword: "weak" });
    expect(res.status).toBe(400);
  });
});

describe("password reset flow", () => {
  it("forgot-password responds identically for known and unknown emails", async () => {
    await registerUser({ email: "reset@veil.test" });
    const known = await api().post("/api/auth/forgot-password").send({ email: "reset@veil.test" });
    const unknown = await api().post("/api/auth/forgot-password").send({ email: "ghost@veil.test" });
    expect(known.status).toBe(200);
    expect(unknown.status).toBe(200);
    expect(known.body).toEqual(unknown.body);
  });

  it("stores only a hash of the reset token", async () => {
    await registerUser({ email: "hash@veil.test" });
    await api().post("/api/auth/forgot-password").send({ email: "hash@veil.test" });
    const raw = lastResetToken();
    const stored = await User.findOne({ email: "hash@veil.test" }).lean();
    expect(stored?.resetPasswordToken).toBeDefined();
    expect(stored?.resetPasswordToken).not.toBe(raw);
  });

  it("resets the password with the emailed token, single use, and revokes sessions", async () => {
    const u = await registerUser({ email: "flow@veil.test" });
    await api().post("/api/auth/forgot-password").send({ email: "flow@veil.test" });
    const token = lastResetToken();

    const res = await api().post("/api/auth/reset-password").send({ token, password: "Reborn12345" });
    expect(res.status).toBe(200);
    expect((await api().get("/api/auth/me").set(auth(u.token))).status).toBe(401);
    expect((await api().post("/api/auth/login").send({ email: "flow@veil.test", password: "Reborn12345" })).status).toBe(200);

    const reuse = await api().post("/api/auth/reset-password").send({ token, password: "Another12345" });
    expect(reuse.status).toBe(400);
    expect(reuse.body.error).toBe("Reset link is invalid or has expired.");
  });

  it("rejects expired reset tokens", async () => {
    await registerUser({ email: "late@veil.test" });
    await api().post("/api/auth/forgot-password").send({ email: "late@veil.test" });
    const token = lastResetToken();
    await User.updateOne({ email: "late@veil.test" }, { resetPasswordExpires: new Date(Date.now() - 1000) });
    const res = await api().post("/api/auth/reset-password").send({ token, password: "Reborn12345" });
    expect(res.status).toBe(400);
  });

  it("rejects malformed tokens", async () => {
    const res = await api().post("/api/auth/reset-password").send({ token: "abc", password: "Reborn12345" });
    expect(res.status).toBe(400);
  });
});
