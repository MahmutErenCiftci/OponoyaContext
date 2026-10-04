"use client";

import { useRouter } from "next/navigation";
import { FeedbackForm } from "../../../components/feedback-form";

/** The page form: a sent report reloads the list beside it. */
export function FeedbackComposer() {
  const router = useRouter();
  return <FeedbackForm onSent={() => router.refresh()} pagePath="/workspace/feedback" />;
}
