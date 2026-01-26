import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign up — Canon",
  description: "Create an account to start editing PDFs with natural language.",
};

export default function SignupPage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-md">
        {/* Logo/Brand */}
        <div className="text-center mb-12">
          <h1 className="text-3xl font-display font-semibold text-text-primary mb-2">
            Canon
          </h1>
          <p className="text-text-secondary font-body">
            Edit PDFs with natural language
          </p>
        </div>

        {/* Signup Card */}
        <div className="bg-surface rounded-2xl border-2 border-border shadow-xl p-8">
          <h2 className="text-2xl font-display font-semibold text-text-primary mb-2">
            Create an account
          </h2>
          <p className="text-text-secondary font-body mb-8">
            Enter your details to get started
          </p>

          {/* Form Inputs */}
          <div className="space-y-6">
            <div>
              <label htmlFor="name" className="block text-sm font-body font-medium text-text-primary mb-2">
                Name
              </label>
              <input
                type="text"
                id="name"
                name="name"
                placeholder="John Doe"
                className="w-full px-4 py-3 rounded-lg border-2 border-border bg-surface-subtle text-text-primary font-body placeholder:text-text-tertiary focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-200"
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-body font-medium text-text-primary mb-2">
                Email
              </label>
              <input
                type="email"
                id="email"
                name="email"
                placeholder="you@example.com"
                className="w-full px-4 py-3 rounded-lg border-2 border-border bg-surface-subtle text-text-primary font-body placeholder:text-text-tertiary focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-200"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-body font-medium text-text-primary mb-2">
                Password
              </label>
              <input
                type="password"
                id="password"
                name="password"
                placeholder="••••••••"
                className="w-full px-4 py-3 rounded-lg border-2 border-border bg-surface-subtle text-text-primary font-body placeholder:text-text-tertiary focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-200"
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              className="w-full py-3 px-4 rounded-lg bg-primary hover:bg-primary-hover text-text-inverse font-body font-medium shadow-md hover:shadow-lg transition-all duration-200 hover:translate-y-[-2px]"
            >
              Create account
            </button>
          </div>

          {/* Divider */}
          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-surface text-text-tertiary font-body">Or continue with</span>
            </div>
          </div>

          {/* Social Auth Buttons */}
          <div className="space-y-3">
            <button
              type="button"
              className="w-full py-3 px-4 rounded-lg border-2 border-border bg-surface hover:bg-surface-subtle text-text-primary font-body font-medium transition-all duration-200 hover:translate-y-[-1px] flex items-center justify-center gap-3"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              <span>Google</span>
            </button>
          </div>

          {/* Sign In Link */}
          <div className="mt-8 text-center">
            <p className="text-sm text-text-secondary font-body">
              Already have an account?{" "}
              <a href="/login" className="text-primary hover:underline font-medium">
                Sign in
              </a>
            </p>
          </div>

          {/* Footer */}
          <p className="mt-8 text-center text-xs text-text-tertiary font-body">
            By continuing, you agree to our{" "}
            <a href="#" className="text-primary hover:underline">Terms of Service</a>
            {" "}and{" "}
            <a href="#" className="text-primary hover:underline">Privacy Policy</a>
          </p>
        </div>
      </div>
    </div>
  );
}
























