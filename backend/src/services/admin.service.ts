import { IMovie, Movie, Role, User, WatchlistEntry } from "../models/index.js";
import { HttpError } from "../utils/httpError.js";
import { escapeRegex, paginate } from "../utils/helpers.js";
import { deleteUserCascade } from "./auth.service.js";
import { toPublicMovie, toPublicUser } from "./serializers.js";

export const getStats = async () => {
  const [users, admins, movies, watchlistEntries, top] = await Promise.all([
    User.estimatedDocumentCount(),
    User.countDocuments({ role: "admin" }),
    Movie.estimatedDocumentCount(),
    WatchlistEntry.estimatedDocumentCount(),
    WatchlistEntry.aggregate<{ _id: string; count: number }>([
      { $group: { _id: "$movieId", count: { $sum: 1 } } },
      { $sort: { count: -1, _id: 1 } },
      { $limit: 5 },
    ]),
  ]);
  // One query for all top titles (no N+1).
  const topMovies = await Movie.find({ id: { $in: top.map((t) => t._id) } }).lean<IMovie[]>();
  const byId = new Map(topMovies.map((m) => [m.id, m]));
  return {
    users,
    admins,
    movies,
    watchlistEntries,
    mostWatchlisted: top.map((t) => {
      const m = byId.get(t._id);
      return { movie_id: t._id, count: t.count, movie: m ? toPublicMovie(m) : null };
    }),
  };
};

export const listUsers = async (q: string, page: number, limit: number) => {
  const filter = q ? { $or: [{ email: new RegExp(escapeRegex(q), "i") }, { username: new RegExp(escapeRegex(q), "i") }] } : {};
  const { skip } = paginate(page, limit);
  const [items, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1, id: 1 }).skip(skip).limit(limit).lean(),
    User.countDocuments(filter),
  ]);
  return { items: items.map(toPublicUser), total, page, limit, totalPages: Math.ceil(total / limit) };
};

export const setRole = async (actorId: string, targetId: string, role: Role) => {
  if (actorId === targetId && role !== "admin") throw HttpError.badRequest("You cannot remove your own admin role");
  const user = await User.findOneAndUpdate(
    { id: targetId },
    // Role changes revoke the target's existing sessions.
    { $set: { role }, $inc: { tokenVersion: 1 } },
    { returnDocument: "after" },
  ).lean();
  if (!user) throw HttpError.notFound("User not found");
  return toPublicUser(user);
};

export const deleteUser = async (actorId: string, targetId: string) => {
  if (actorId === targetId) throw HttpError.badRequest("You cannot delete your own account from the admin panel");
  if (!(await deleteUserCascade(targetId))) throw HttpError.notFound("User not found");
};
