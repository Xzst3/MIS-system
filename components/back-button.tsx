"use client";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
export function BackButton() {
  const router = useRouter();
  return (
    <button
      className="button button-outline privacy-page-return"
      onClick={() => {
        if (window.history.length > 1) router.back();
        else router.push("/");
      }}
    >
      <ArrowLeft size={18} />
      Back to the previous page
    </button>
  );
}
