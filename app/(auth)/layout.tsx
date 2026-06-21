/** Minimal centered layout for auth screens (login, onboarding). No bottom nav. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col items-center justify-center px-4 py-8">
      {children}
    </div>
  );
}
