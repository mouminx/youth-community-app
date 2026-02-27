// Root page — middleware redirects logged-in users to /communities
// and unauthenticated users trying to access /c/* to /login.
// If someone lands here without being logged in, show a simple splash.
import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4">
      <h1 className="text-3xl font-bold">Youth Community</h1>
      <p className="text-gray-400">Multi-tenant community platform with gamification</p>
      <Link
        href="/login"
        className="rounded-lg bg-indigo-600 px-6 py-2 font-medium hover:bg-indigo-500"
      >
        Get started
      </Link>
    </div>
  );
}
