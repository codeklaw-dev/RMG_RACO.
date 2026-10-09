import Link from "next/link";
import { Compass } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";

export default function NotFound() {
  return (
    <EmptyState
      icon={Compass}
      title="This page isn't part of the studio"
      description="It may be disabled in this demo or the link is out of date."
      action={<Link href="/" className="t-meta underline">Back to overview</Link>}
    />
  );
}
