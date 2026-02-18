// src/routes/auth.routes.ts
import { Router } from "express";
import { createUser } from "../db/user.model";

const router = Router();

router.post("/register", async (req, res) => {
  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ error: "Missing fields" });
  }

  try {
    await createUser(username, email, password);
    res.status(201).json({ message: "User created" });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
