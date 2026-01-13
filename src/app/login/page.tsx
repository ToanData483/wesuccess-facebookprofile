"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Eye,
  EyeOff,
  ArrowLeft,
  MessageCircle,
  Loader2,
} from "lucide-react";
import { login } from "@/lib/wesuccess-auth";

/**
 * Login Page - Facebook Manager
 * Uses WeSuccess Centralized Auth API
 */
export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email || !password) {
      setError("Vui lòng nhập email và mật khẩu");
      return;
    }

    setLoading(true);

    const result = await login(email, password);

    if (result.success) {
      router.push("/");
    } else {
      setError(result.error || "Đăng nhập thất bại");
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Panel - Login Form */}
      <div className="w-full lg:w-1/2 flex flex-col bg-white">
        {/* Back button */}
        <div className="p-6">
          <button
            onClick={() => router.back()}
            className="inline-flex items-center gap-2 text-slate-400 hover:text-[#1877F2] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
        </div>

        {/* Form Container - Centered */}
        <div className="flex-1 flex items-center justify-center px-8 pb-12">
          <div className="w-full max-w-md">
            {/* Form Header */}
            <h1 className="text-3xl font-bold text-black mb-10">Đăng nhập</h1>

            {/* Login Form */}
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Email Field */}
              <div>
                <label className="block text-base font-medium text-black mb-2">
                  Email <span className="text-[#1877F2]">*</span>
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3.5 bg-white border-2 border-gray-200 rounded-lg text-black text-base focus:outline-none focus:ring-2 focus:ring-[#1877F2]/20 focus:border-[#1877F2] transition-all"
                />
              </div>

              {/* Password Field */}
              <div>
                <label className="block text-base font-medium text-black mb-2">
                  Mật khẩu <span className="text-[#1877F2]">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-3.5 pr-12 bg-white border-2 border-gray-200 rounded-lg text-black text-base focus:outline-none focus:ring-2 focus:ring-[#1877F2]/20 focus:border-[#1877F2] transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-black transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {/* Error Message */}
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
                  {error}
                </div>
              )}

              {/* Submit Button - Facebook Blue */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 mt-2 bg-[#1877F2] hover:bg-[#166FE5] disabled:opacity-50 text-white font-semibold text-base rounded-lg flex items-center justify-center gap-2 transition-all"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Đang xác thực...
                  </>
                ) : (
                  "Đăng nhập"
                )}
              </button>
            </form>

            {/* Divider */}
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-white text-gray-400">hoặc</span>
              </div>
            </div>

            {/* Contact Admin Button */}
            <a
              href="https://zalo.me/0363483483"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-3.5 bg-white border-2 border-gray-200 rounded-lg text-base font-medium text-black hover:bg-gray-50 transition-all flex items-center justify-center gap-2"
            >
              <MessageCircle className="w-5 h-5" />
              Liên hệ Admin qua Zalo
            </a>

            {/* Footer Links */}
            <div className="mt-8 pt-6 border-t border-gray-200 text-center text-base text-gray-500">
              <p>Chưa có tài khoản? Liên hệ Admin</p>
              <p className="mt-1 font-medium text-black">Hotline: 036.348.3483</p>
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel - Hero (Facebook style - blue gradient) */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-[#1877F2] to-[#0D5DC7] flex-col relative overflow-hidden">
        {/* Facebook Logo - Top Right */}
        <div className="absolute top-6 right-8 z-20">
          <svg viewBox="0 0 36 36" className="w-12 h-12" fill="white">
            <path d="M20.181 35.87C29.094 34.791 36 27.202 36 18c0-9.941-8.059-18-18-18S0 8.059 0 18c0 8.442 5.811 15.526 13.652 17.471L14 34h5.5l.681 1.87Z"></path>
            <path fill="#1877F2" d="M13.651 35.471v-11.97H9.936V18h3.715v-2.37c0-6.127 2.772-8.964 8.784-8.964 1.138 0 3.103.223 3.91.446v4.983c-.425-.043-1.167-.065-2.081-.065-2.952 0-4.09 1.116-4.09 4.025V18h5.883l-1.008 5.5h-4.867v12.37a18.183 18.183 0 0 1-6.53-.399Z"></path>
          </svg>
        </div>

        {/* Centered Content */}
        <div className="flex-1 flex items-center justify-center px-16">
          <div className="text-center max-w-lg">
            <h2 className="text-5xl font-black text-white mb-4 tracking-tight">
              Facebook Manager
            </h2>
            <p className="text-3xl font-bold text-white/90 mb-8">
              #WeSuccessTools
            </p>
            <p className="text-white/80 text-xl leading-relaxed mb-4">
              Download, Transcript, và Analytics cho Facebook.
            </p>
            <p className="text-white/60 text-base">
              Dành cho thành viên WeSuccess
            </p>
          </div>
        </div>

        {/* Decorative circles */}
        <div className="absolute -bottom-32 -right-32 w-[400px] h-[400px] bg-white/10 rounded-full blur-3xl" />
        <div className="absolute top-1/4 -left-20 w-64 h-64 bg-white/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/3 right-10 w-32 h-32 bg-[#42B72A]/20 rounded-full blur-2xl" />

        {/* Footer */}
        <div className="absolute bottom-6 left-0 right-0 flex items-center justify-between px-8 text-sm text-white/50">
          <span>v1.0.0</span>
          <span>© 2026 Cảnh Toàn WeSuccess</span>
        </div>
      </div>
    </div>
  );
}
