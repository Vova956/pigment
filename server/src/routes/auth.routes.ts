import { Router } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { createUser, findUserByEmail } from "../db/user.model";

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET || "dev_secret_change_me";

// REGISTER (if you already have it, keep it)
router.post("/register", async (req, res) => {
  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ error: "Missing fields" });
  }

  try {
    await createUser(username, email, password);
    return res.status(201).json({ message: "User created" });
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

//LOGIN
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Missing email or password" });
  }

  try {
    const user = await findUserByEmail(email);
    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Create a token that identifies the user
    const token = jwt.sign(
      { userId: user.id, username: user.username, email: user.email },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    // Return minimal user info + token
    return res.json({
      token,
      user: { id: user.id, username: user.username, email: user.email },
    });
  } catch (err: any) {
    return res.status(500).json({ error: "Login failed" });
  }
});

export default router;