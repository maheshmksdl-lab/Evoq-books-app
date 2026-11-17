"use client";
import { JournalWorkspace } from "@/components/features/journal-workspace";
import { useUrlParams } from "@/hooks/use-misc";
export default function NewJournalPage() { const p = useUrlParams(); if (!p) return null; return <JournalWorkspace copyFrom={p.get("copy")} />; }
