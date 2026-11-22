import request from "supertest";
import { createApp } from "../src/app";
import { SEED_MOVIES } from "../src/data/catalog";
import { Movie, User } from "../src/models";
import { testOutbox } from "../src/services/mail.service";

/** App under test: DB is connected by tests/setup.ts, no static hosting. */
export const app = createApp({ staticDir: null, autoConnect: false });

export const api = () => request(app);

let counter = 0;

export interface TestUser {
  token: string;
  user: { id: string; email: string; username: string; role: string; favorite_genre: string; avatar_url: string; created_at: string };
  password: string;
}

export const registerUser = async (overrides: Partial<{ username: string; email: string; password: string }> = {}): Promise<TestUser> => {
  counter += 1;
  const body = {
    username: overrides.username ?? `ghost_${counter}`,
    email: overrides.email ?? `ghost${counter}@veil.test`,
    password: overrides.password ?? "Spooky123",
  };
  const res = await api().post("/api/auth/register").send(body);
  if (res.status !== 201) throw new Error(`register failed: ${res.status} ${JSON.stringify(res.body)}`);
  return { token: res.body.token, user: res.body.user, password: body.password };
};

/** Registers a user and promotes them to admin directly in the DB. */
export const registerAdmin = async (): Promise<TestUser> => {
  const admin = await registerUser();
  await User.updateOne({ id: admin.user.id }, { role: "admin" });
  return { ...admin, user: { ...admin.user, role: "admin" } };
};

export const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

/** Inserts the original 8-title catalog. */
export const seedCatalog = () => Movie.insertMany(SEED_MOVIES);

/** Extracts the raw token from the last captured reset email. */
export const lastResetToken = (): string => {
  const mail = testOutbox.at(-1);
  if (!mail) throw new Error("no email captured");
  return new URL(mail.link).searchParams.get("token")!;
};
