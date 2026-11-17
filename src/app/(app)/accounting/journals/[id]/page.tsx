"use client";
import { useParams } from "next/navigation";
import { JournalWorkspace } from "@/components/features/journal-workspace";
export default function JournalPage() { const { id } = useParams<{ id: string }>(); return <JournalWorkspace id={id} />; }
