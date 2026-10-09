import type { Metadata } from "next";
import { Suspense } from "react";
import { EditorView } from "@/components/editor/editor-view";

export const metadata: Metadata = { title: "Design Editor" };

export default function EditorPage() {
  return (
    <Suspense>
      <EditorView />
    </Suspense>
  );
}
