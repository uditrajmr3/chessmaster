"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  motion,
  AnimatePresence,
  useMotionValue,
  useTransform,
} from "framer-motion";
import { Mail, Lock, Eye, EyeClosed, ArrowRight } from "lucide-react";
import Logo from "@/components/Logo";

import { cn } from "@/lib/utils";
import { useAuth, AuthError } from "@/lib/auth";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "flex h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base outline-none transition-[color,box-shadow] disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        className
      )}
      {...props}
    />
  );
}

export function Component() {
  const router = useRouter();
  const { login } = useAuth();

  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [focusedInput, setFocusedInput] = useState<"email" | "password" | null>(
    null
  );
  const [rememberMe, setRememberMe] = useState(false);

  // 3D card tilt that tracks the cursor.
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const rotateX = useTransform(mouseY, [-300, 300], [8, -8]);
  const rotateY = useTransform(mouseX, [-300, 300], [-8, 8]);

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    mouseX.set(e.clientX - rect.left - rect.width / 2);
    mouseY.set(e.clientY - rect.top - rect.height / 2);
  };

  const handleMouseLeave = () => {
    mouseX.set(0);
    mouseY.set(0);
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isLoading) return;
    setError("");
    setIsLoading(true);
    try {
      await login(email, password);
      router.push("/");
    } catch (err) {
      setError(
        err instanceof AuthError
          ? "Invalid email or password"
          : "Something went wrong. Please try again."
      );
      setIsLoading(false);
    }
  }

  // Warm taupe traveling-beam color (rodeo-dust 300).
  const beam =
    "bg-gradient-to-r from-transparent via-[#c2ad95] to-transparent";
  const beamV =
    "bg-gradient-to-b from-transparent via-[#c2ad95] to-transparent";

  return (
    <div className="min-h-screen w-full relative overflow-hidden flex items-center justify-center px-4 py-10">
      {/* Moonwalker field: navy falling to black, with a warm bloom up top. */}
      <div className="absolute inset-0 bg-[radial-gradient(120%_90%_at_50%_-10%,#1c2f40_0%,#152331_34%,#0a1219_66%,#000000_100%)]" />

      {/* Grain */}
      <div
        className="absolute inset-0 opacity-[0.04] mix-blend-soft-light"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
          backgroundSize: "200px 200px",
        }}
      />

      {/* Warm accent glows */}
      <motion.div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[110vh] h-[55vh] rounded-b-full bg-[#a78368]/15 blur-[90px]"
        animate={{ opacity: [0.18, 0.32, 0.18], scale: [0.98, 1.03, 0.98] }}
        transition={{ duration: 9, repeat: Infinity, repeatType: "mirror" }}
      />
      <motion.div
        className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[80vh] h-[80vh] rounded-t-full bg-[#152331]/60 blur-[70px]"
        animate={{ opacity: [0.3, 0.5, 0.3], scale: [1, 1.08, 1] }}
        transition={{ duration: 7, repeat: Infinity, repeatType: "mirror", delay: 1 }}
      />

      <motion.div
        initial={{ opacity: 0, y: 22 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className="w-full relative z-10"
        style={{ perspective: 1500, maxWidth: "25rem" }}
      >
        <motion.div
          className="relative"
          style={{ rotateX, rotateY }}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          <div className="relative group">
            {/* Soft halo */}
            <motion.div
              className="absolute -inset-[1px] rounded-2xl"
              animate={{ opacity: [0.25, 0.45, 0.25] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", repeatType: "mirror" }}
              style={{ boxShadow: "0 0 30px 4px rgba(167,131,104,0.12)" }}
            />

            {/* Traveling light beams (warm taupe) */}
            <div className="absolute -inset-[1px] rounded-2xl overflow-hidden">
              <motion.div
                className={`absolute top-0 left-0 h-[2px] w-[50%] opacity-70 ${beam}`}
                animate={{ left: ["-50%", "100%"], opacity: [0.25, 0.7, 0.25] }}
                transition={{ left: { duration: 3, ease: "easeInOut", repeat: Infinity, repeatDelay: 1 }, opacity: { duration: 1.4, repeat: Infinity, repeatType: "mirror" } }}
              />
              <motion.div
                className={`absolute top-0 right-0 w-[2px] h-[50%] opacity-70 ${beamV}`}
                animate={{ top: ["-50%", "100%"], opacity: [0.25, 0.7, 0.25] }}
                transition={{ top: { duration: 3, ease: "easeInOut", repeat: Infinity, repeatDelay: 1, delay: 0.7 }, opacity: { duration: 1.4, repeat: Infinity, repeatType: "mirror", delay: 0.7 } }}
              />
              <motion.div
                className={`absolute bottom-0 right-0 h-[2px] w-[50%] opacity-70 ${beam}`}
                animate={{ right: ["-50%", "100%"], opacity: [0.25, 0.7, 0.25] }}
                transition={{ right: { duration: 3, ease: "easeInOut", repeat: Infinity, repeatDelay: 1, delay: 1.4 }, opacity: { duration: 1.4, repeat: Infinity, repeatType: "mirror", delay: 1.4 } }}
              />
              <motion.div
                className={`absolute bottom-0 left-0 w-[2px] h-[50%] opacity-70 ${beamV}`}
                animate={{ bottom: ["-50%", "100%"], opacity: [0.25, 0.7, 0.25] }}
                transition={{ bottom: { duration: 3, ease: "easeInOut", repeat: Infinity, repeatDelay: 1, delay: 2.1 }, opacity: { duration: 1.4, repeat: Infinity, repeatType: "mirror", delay: 2.1 } }}
              />
            </div>

            {/* Glass card */}
            <div className="relative bg-[#0c1722]/70 backdrop-blur-xl rounded-2xl p-7 border border-white/[0.06] shadow-[0_30px_60px_-20px_rgba(0,0,0,0.8)] overflow-hidden">
              {/* faint inner grid */}
              <div
                className="absolute inset-0 opacity-[0.04]"
                style={{
                  backgroundImage:
                    "linear-gradient(135deg, white 0.5px, transparent 0.5px), linear-gradient(45deg, white 0.5px, transparent 0.5px)",
                  backgroundSize: "34px 34px",
                }}
              />

              {/* Brand + heading */}
              <div className="text-center space-y-2 mb-7 relative">
                <motion.div
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", duration: 0.8 }}
                  className="mx-auto w-12 h-12 rounded-2xl flex items-center justify-center bg-[#a78368]/12 border border-[#a78368]/25 accent-glow"
                >
                  <Logo className="w-5 h-5 text-accent-300" />
                </motion.div>

                <motion.h1
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 }}
                  className="font-display text-[1.7rem] leading-none font-semibold text-white pt-1"
                >
                  ChessInt
                </motion.h1>

                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.25 }}
                  className="text-white/55 text-[0.8rem]"
                >
                  Sign in to study your game
                </motion.p>
              </div>

              <form onSubmit={handleSubmit} noValidate className="space-y-4 relative">
                {/* Email */}
                <div className="relative">
                  <div className="relative flex items-center overflow-hidden rounded-lg">
                    <Mail
                      className={`absolute left-3 w-4 h-4 transition-colors duration-300 ${
                        focusedInput === "email" ? "text-accent-300" : "text-white/40"
                      }`}
                    />
                    <Input
                      type="email"
                      autoComplete="email"
                      required
                      aria-label="Email address"
                      placeholder="Email address"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      onFocus={() => setFocusedInput("email")}
                      onBlur={() => setFocusedInput(null)}
                      className="w-full bg-white/[0.04] border-white/10 focus:border-accent-500/60 focus:ring-2 focus:ring-accent-500/20 text-white placeholder:text-white/30 h-11 transition-all duration-300 pl-10 pr-3"
                    />
                  </div>
                </div>

                {/* Password */}
                <div className="relative">
                  <div className="relative flex items-center overflow-hidden rounded-lg">
                    <Lock
                      className={`absolute left-3 w-4 h-4 transition-colors duration-300 ${
                        focusedInput === "password" ? "text-accent-300" : "text-white/40"
                      }`}
                    />
                    <Input
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      required
                      aria-label="Password"
                      placeholder="Password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onFocus={() => setFocusedInput("password")}
                      onBlur={() => setFocusedInput(null)}
                      className="w-full bg-white/[0.04] border-white/10 focus:border-accent-500/60 focus:ring-2 focus:ring-accent-500/20 text-white placeholder:text-white/30 h-11 transition-all duration-300 pl-10 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((s) => !s)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      className="absolute right-3 text-white/40 hover:text-white transition-colors duration-300"
                    >
                      {showPassword ? <Eye className="w-4 h-4" /> : <EyeClosed className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Error */}
                <AnimatePresence>
                  {error && (
                    <motion.p
                      role="alert"
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="text-[0.8rem] text-red-400"
                    >
                      {error}
                    </motion.p>
                  )}
                </AnimatePresence>

                {/* Remember + forgot */}
                <div className="flex items-center justify-between pt-0.5">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <span className="relative inline-flex">
                      <input
                        type="checkbox"
                        checked={rememberMe}
                        onChange={() => setRememberMe((v) => !v)}
                        className="appearance-none h-4 w-4 rounded border border-white/20 bg-white/5 checked:bg-accent-500 checked:border-accent-500 focus:outline-none focus:ring-2 focus:ring-accent-500/30 transition-all duration-200"
                      />
                      {rememberMe && (
                        <svg
                          className="absolute inset-0 m-auto pointer-events-none text-[#0b141d]"
                          width="11" height="11" viewBox="0 0 24 24" fill="none"
                          stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"
                        >
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </span>
                    <span className="text-xs text-white/55">Remember me</span>
                  </label>

                  <Link
                    href="/forgot-password"
                    className="text-xs text-white/55 hover:text-accent-300 transition-colors duration-200"
                  >
                    Forgot password?
                  </Link>
                </div>

                {/* Submit */}
                <motion.button
                  whileHover={{ scale: 1.015 }}
                  whileTap={{ scale: 0.985 }}
                  type="submit"
                  disabled={isLoading}
                  className="w-full relative group/button mt-2 btn-press disabled:opacity-80"
                >
                  <div className="absolute inset-0 bg-accent-500/40 rounded-lg blur-lg opacity-0 group-hover/button:opacity-60 transition-opacity duration-300" />
                  <div className="relative overflow-hidden bg-accent-500 hover:bg-accent-400 text-[#1a120c] font-semibold h-11 rounded-lg transition-colors duration-300 flex items-center justify-center">
                    <AnimatePresence mode="wait">
                      {isLoading ? (
                        <motion.span key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center">
                          <span className="w-4 h-4 border-2 border-[#1a120c]/60 border-t-transparent rounded-full animate-spin" />
                        </motion.span>
                      ) : (
                        <motion.span key="text" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-1.5 text-sm">
                          Sign in
                          <ArrowRight className="w-4 h-4 group-hover/button:translate-x-0.5 transition-transform duration-300" />
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.button>

                {/* Sign up */}
                <p className="text-center text-xs text-white/55 pt-1">
                  New to ChessInt?{" "}
                  <Link href="/register" className="relative inline-block group/su font-medium text-white">
                    <span className="group-hover/su:text-accent-300 transition-colors duration-300">Create an account</span>
                    <span className="absolute -bottom-0.5 left-0 h-px w-0 bg-accent-400 group-hover/su:w-full transition-all duration-300" />
                  </Link>
                </p>
              </form>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
