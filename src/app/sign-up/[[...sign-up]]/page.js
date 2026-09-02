// src/app/sign-up/[[...sign-up]]/page.js
import { SignUp } from "@clerk/nextjs";

export default function Page() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-4">
      <div className="p-6 bg-white rounded-3xl shadow-xl border border-slate-200">
        <SignUp
          path="/sign-up"
          routing="path"
          signInUrl="/sign-in"
          appearance={{
            elements: {
              formButtonPrimary: "bg-rose-500 hover:bg-rose-600 text-white font-bold",
              footerActionLink: "text-rose-600 font-medium hover:text-rose-700"
            }
          }}
        />
      </div>
    </main>
  );
}